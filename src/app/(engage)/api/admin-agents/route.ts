import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { resolveD1Binding } from '@/cms/db/connect'
import { retentionCutoff, validateGrantInput, DEFAULT_RETENTION_DAYS, describeCaps } from '@/features/agentAccess/core'
import * as store from '@/features/agentAccess/store'
import { createApiKey, createD1ApiKeyStore, scopableCollections, type ApiKeyDeps, type D1Like, type LiveOwner } from '@/features/apiKeys'
import { reauthenticate } from '@/features/accounts/passkeysWiring'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { hit } from '@/features/security/rateLimit'
import { getSecuritySettings } from '@/features/security/settings'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage AI agent access.' }, 403) }
  if (!(await getFeatureFlags()).agents) return { response: json({ error: 'Switch AI agent access on in Site Settings first.' }, 409) }
  return { context }
}

const keyStore = () => createD1ApiKeyStore(async () => (await resolveD1Binding()) as unknown as D1Like)

/** GET: every agent token with its key's state and today's use, the collections a scope can name, and the latest actions. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const now = Date.now()
  const grantId = Number(new URL(request.url).searchParams.get('grant')) || null
  const engine = await getEngine()
  const settings = await getSecuritySettings(engine as never)
  const [grants, totals, actions, keys] = await Promise.all([store.listGrants(d1), store.todayTotals(d1, now), store.recentActions(d1, grantId, 100), keyStore().listAll()])
  const byKey = new Map(keys.map((k) => [k.id, k]))
  return json({
    apiKeysOn: settings.apiKeys.enabled,
    maxLifetimeDays: settings.apiKeys.maxLifetimeDays,
    collections: scopableCollections(engine.config.collections as unknown as Array<{ slug?: unknown; labels?: { plural?: unknown } | null }>),
    grants: grants.map((gr) => {
      const key = byKey.get(gr.keyId)
      return {
        ...gr,
        caps: describeCaps(gr),
        prefix: key?.prefix ?? '',
        scopes: key?.scopes ?? [],
        expiresAt: key?.expiresAt ?? null,
        lastUsedAt: key?.lastUsedAt ?? null,
        keyRevoked: Boolean(key?.revokedAt),
        usedToday: totals[gr.id] ?? { reads: 0, writes: 0 },
      }
    }),
    actions,
  })
}

/**
 * POST { action: 'create', label, tool, dailyWriteCap, dailyReadCap, scopes, expiresInDays, password, code }
 *    | { action: 'caps', id, dailyWriteCap, dailyReadCap } | { action: 'revoke', id } | { action: 'purge' }
 * Creating a token makes a scoped API key owned by the admin and shows it once.
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const user = g.context.user as unknown as { id: number; email: string; roles?: string[] }
  const engine = await getEngine()
  const settings = await getSecuritySettings(engine as never)
  const origin = auditContext(request)
  const note = async (action: 'api-key.created' | 'api-key.revoked', documentId: number | null, detail: string): Promise<void> => {
    try {
      await audit({ action, actorId: user.id, actorEmail: user.email, documentId, detail, collectionSlug: 'api-keys', ...origin }, settings)
    } catch {
      // A log line never fails the action.
    }
  }

  if (body.action === 'create') {
    if (!settings.apiKeys.enabled) return json({ error: 'API keys are not turned on. Switch them on in Security settings first.' }, 409)
    if (hit(`agents:create:${user.id}`, 10).limited) return json({ error: 'Too many tokens made in a short time. Try again later.' }, 429)
    const input = validateGrantInput(body)
    if (input.ok === false) return json({ error: input.error }, 400)
    if (!(await reauthenticate(Number(user.id), { password: typeof body.password === 'string' ? body.password : undefined, code: typeof body.code === 'string' ? body.code : undefined }))) {
      return json({ error: 'Enter your current password or a two-step code to create an agent token.' }, 403)
    }
    const deps: ApiKeyDeps = {
      store: keyStore(),
      now: () => Date.now(),
      audit: async () => undefined,
      loadOwner: async (): Promise<LiveOwner | null> => ({ id: Number(user.id), email: user.email, roles: user.roles ?? [], locked: false, user }),
    }
    const owner: LiveOwner = { id: Number(user.id), email: user.email, roles: user.roles ?? [], locked: false, user }
    const created = await createApiKey(deps, owner, { name: `Agent: ${input.value.label}`, scopes: body.scopes, expiresInDays: body.expiresInDays }, settings.apiKeys)
    if (created.ok === false) return json({ error: created.error }, 400)
    await store.insertGrant(d1, { keyId: created.value.row.id, ...input.value, createdBy: Number(user.id) }, now.toISOString())
    await note('api-key.created', created.value.row.id, `agent token for ${input.value.label}: ${created.value.row.scopes.join(',')}`)
    return json({ ok: true, key: created.value.key })
  }
  if (body.action === 'caps') {
    const id = Math.floor(Number(body.id))
    const parsed = validateGrantInput({ label: 'x', dailyWriteCap: body.dailyWriteCap, dailyReadCap: body.dailyReadCap })
    if (!Number.isFinite(id) || id < 1 || parsed.ok === false) return json({ error: 'Unknown agent.' }, 400)
    const ok = await store.updateCaps(d1, id, parsed.value.dailyWriteCap, parsed.value.dailyReadCap)
    return ok ? json({ ok: true }) : json({ error: 'Unknown agent.' }, 404)
  }
  if (body.action === 'revoke') {
    const id = Math.floor(Number(body.id))
    const grant = (await store.listGrants(d1)).find((x) => x.id === id)
    if (!grant) return json({ error: 'Unknown agent.' }, 404)
    await store.revokeGrant(d1, id, now.toISOString())
    await keyStore().revoke(grant.keyId, now.toISOString())
    await note('api-key.revoked', grant.keyId, `agent token ${grant.label} revoked by an admin`)
    return json({ ok: true })
  }
  if (body.action === 'purge') {
    const cutoff = retentionCutoff(now, DEFAULT_RETENTION_DAYS)
    return json({ ok: true, removed: cutoff ? await store.purgeOlderThan(d1, cutoff) : 0 })
  }
  return json({ error: 'Unknown action.' }, 400)
}
