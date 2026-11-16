import { ApiKeyRefused, API_KEY_RATE_PER_MINUTE, presentedApiKey, scopesAllow, type ApiKeyContext } from '@/features/apiKeys'
import { resolveAccess } from '@/features/roles/permissions'
import { hit } from '@/features/security/rateLimit'

import { answerFields } from './csv'
import { withFileLinks } from './fileLinks'
import type { FormDoc } from './types'

/**
 * The form data API: another system reads a form's field definitions and its
 * entries with an API key.
 *
 *   GET /api/forms/{id}               field definitions (name, label, type, required, options)
 *   GET /api/forms/{id}/submissions   entries, paged, with since / until, JSON or CSV
 *
 * The key needs the scope `forms:read` for definitions and `form-submissions:read`
 * for entries (created under Security > API keys; a key can never do more than its
 * owner can). `{id}` is the form id. Spam entries are left out. IP address, browser,
 * notes and assignee are internal and are never returned. Files come back as name,
 * size, type and a signed link that stops working after 7 days.
 */

/** Flat on purpose: strictNullChecks is off here, so a union would not narrow on `ok`. */
export type DataApiAuth = { ok: boolean; key?: ApiKeyContext; response?: Response }

const fail = (status: number, message: string, headers: Record<string, string> = {}): DataApiAuth => ({
  ok: false,
  response: Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store', ...headers } }),
})

type AuthEngine = { auth: (args: { headers: Headers; apiKeys: boolean }) => Promise<{ apiKey?: ApiKeyContext; user?: unknown }> }

/** Checks the presented key, its rate limit and that it holds `collection:read`. */
export async function authoriseKey(engine: AuthEngine, request: Request, collection: 'forms' | 'form-submissions'): Promise<DataApiAuth> {
  if (!presentedApiKey(request.headers)) return fail(401, 'Send an API key as "Authorization: Bearer egk_..." or in the X-API-Key header.')
  let key: ApiKeyContext | undefined
  let owner: unknown
  try {
    const result = await engine.auth({ headers: request.headers, apiKeys: true })
    key = result.apiKey
    owner = result.user
  } catch (error) {
    if (error instanceof ApiKeyRefused) return fail(error.status, error.message)
    return fail(500, 'Something went wrong.')
  }
  if (!key) return fail(401, 'API key is not valid.')
  const limit = hit(`api-key:${key.id}`, key.ratePerMinute ?? API_KEY_RATE_PER_MINUTE)
  if (limit.limited) return fail(429, 'Too many requests for this API key. Try again in a moment.', { 'Retry-After': String(limit.retryAfterSeconds) })
  if (!scopesAllow(key.scopes, collection, 'read')) return fail(403, `This key does not have the ${collection}:read scope.`)
  // A key never does more than its owner: the owner must be allowed to read all of these entries.
  const roles = (owner as { roles?: string[] } | null | undefined)?.roles || []
  if (!roles.includes('admin') && resolveAccess(owner as never, collection as never, 'read') !== 'all') return fail(403, 'The owner of this key may not read this data.')
  return { ok: true, key }
}

export const MAX_PAGE_SIZE = 200
export const DEFAULT_PAGE_SIZE = 50

export type SubmissionQuery = { page: number; limit: number; since?: string; until?: string; format: 'json' | 'csv'; status?: string }

const toIso = (value: string | null): string | undefined => {
  if (!value) return undefined
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Reads and bounds the query string. `until` as a bare date means the end of that day. */
export function parseSubmissionQuery(params: URLSearchParams): SubmissionQuery | { error: string } {
  const since = params.get('since')
  const until = params.get('until')
  const sinceIso = toIso(since)
  let untilIso = toIso(until)
  if (since && !sinceIso) return { error: 'since must be a date (2026-01-31) or a full timestamp.' }
  if (until && !untilIso) return { error: 'until must be a date (2026-01-31) or a full timestamp.' }
  if (until && untilIso && /^\d{4}-\d{2}-\d{2}$/.test(until)) untilIso = new Date(new Date(untilIso).getTime() + 86_400_000 - 1).toISOString()
  const format = params.get('format') === 'csv' ? 'csv' : 'json'
  const rawLimit = Number(params.get('limit'))
  const rawPage = Number(params.get('page'))
  const status = params.get('status') || undefined
  if (status && !['new', 'read', 'archived'].includes(status)) return { error: 'status must be new, read or archived.' }
  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    limit: Number.isSafeInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
    since: sinceIso,
    until: untilIso,
    format,
    status,
  }
}

export function submissionsQuery(formId: number | string, query: SubmissionQuery): Record<string, unknown> {
  const and: Record<string, unknown>[] = [{ form: { equals: formId } }, query.status ? { status: { equals: query.status } } : { status: { not_equals: 'spam' } }]
  if (query.since) and.push({ submittedAt: { greater_than_equal: query.since } })
  if (query.until) and.push({ submittedAt: { less_than_equal: query.until } })
  return { and }
}

export type PublicEntry = {
  id: number | string
  submittedAt?: string
  status?: string
  sourceUrl?: string
  total?: number
  currency?: string
  values: Record<string, unknown>
}

/** The shape another system sees: no IP, browser, notes or assignee; files as signed links. */
export async function shapeEntry(doc: Record<string, unknown>, origin: string): Promise<PublicEntry> {
  return {
    id: doc.id as number | string,
    submittedAt: (doc.submittedAt || doc.createdAt) as string | undefined,
    status: doc.status as string | undefined,
    sourceUrl: (doc.sourceUrl as string) || undefined,
    total: (doc.total as number) || undefined,
    currency: (doc.currency as string) || undefined,
    values: await withFileLinks((doc.values || {}) as Record<string, unknown>, origin),
  }
}

/** The form as another system needs it to map the answers: field names, labels, types, options. Never notification or webhook settings. */
export function describeForm(form: FormDoc): Record<string, unknown> {
  return {
    id: form.id,
    title: form.title || '',
    status: form.formStatus || 'published',
    fields: answerFields(form).map((field) => ({
      name: field.name,
      label: field.label || field.name,
      type: field.type,
      required: Boolean(field.required),
      ...(field.options?.length ? { options: field.options } : {}),
    })),
    submissionsUrl: `/api/forms/${form.id}/submissions`,
  }
}
