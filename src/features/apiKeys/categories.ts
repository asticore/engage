import { normalizeScope, validateScopes, type ApiKeyScope, type ValidationResult } from './core'

/**
 * API access categories: the pure rules. An admin defines categories (partner, customer, internal).
 * A category holds the most its people may reach (scopes), a rate limit per key and a cap on keys.
 * A key's own scopes are always narrowed to its owner's category when the key is used, so changing
 * a category takes effect on every existing key at once, and a key can never reach more than the
 * category allows.
 */

export const MAX_CATEGORIES = 100
export const MAX_CATEGORY_RATE_PER_MINUTE = 6000
export const DEFAULT_CATEGORY_RATE_PER_MINUTE = 120
export const MAX_CATEGORY_KEYS = 50
export const DEFAULT_CATEGORY_KEYS = 5

export const SUBJECT_TYPES = ['user', 'organization'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export type ApiCategoryConfig = {
  name: string
  description: string
  scopes: ApiKeyScope[]
  ratePerMinute: number
  maxKeys: number
}

export type ApiCategory = ApiCategoryConfig & { id: number; createdAt: string; updatedAt: string }

/** Everything the key path needs to know about a person's category. */
export type CategoryLimits = Pick<ApiCategory, 'id' | 'name' | 'scopes' | 'ratePerMinute' | 'maxKeys'>

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function validateCategory(input: unknown): ValidationResult<ApiCategoryConfig> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'The category is missing its details.' }
  const raw = input as Record<string, unknown>
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (name.length === 0 || name.length > 60) return { ok: false, error: 'Give the category a name of 60 characters or fewer.' }
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 300) : ''
  const scopes = validateScopes(raw.scopes)
  if (scopes.ok === false) return { ok: false, error: scopes.error }
  return {
    ok: true,
    value: {
      name,
      description,
      scopes: scopes.value,
      ratePerMinute: clampInt(raw.ratePerMinute, DEFAULT_CATEGORY_RATE_PER_MINUTE, 1, MAX_CATEGORY_RATE_PER_MINUTE),
      maxKeys: clampInt(raw.maxKeys, DEFAULT_CATEGORY_KEYS, 1, MAX_CATEGORY_KEYS),
    },
  }
}

const part = (a: string, b: string): string | null => (a === '*' ? b : b === '*' ? a : a === b ? a : null)

/**
 * The scopes both lists allow. `pages:read` narrowed by `*:*` stays `pages:read`; `*:read` narrowed by
 * `pages:*` becomes `pages:read`; `orders:write` narrowed by `pages:*` is dropped. Legacy `read` and
 * `write` count as `*:read` and `*:write`.
 */
export function intersectScopes(keyScopes: readonly string[], categoryScopes: readonly string[]): ApiKeyScope[] {
  const out: string[] = []
  for (const k of keyScopes) {
    const fk = normalizeScope(k)
    if (!fk) continue
    const [kc, ka] = fk.split(':')
    for (const c of categoryScopes) {
      const fc = normalizeScope(c)
      if (!fc) continue
      const [cc, ca] = fc.split(':')
      const collection = part(kc, cc)
      const action = part(ka, ca)
      if (collection === null || action === null) continue
      const scope = `${collection}:${action}`
      if (!out.includes(scope)) out.push(scope)
    }
  }
  return out
}

/** The requested scopes that the category does not cover at all, for a clear refusal when a key is created. */
export function scopesOutsideCategory(requested: readonly string[], categoryScopes: readonly string[]): string[] {
  return requested.filter((scope) => intersectScopes([scope], categoryScopes).length === 0)
}

/** The key rate: the category's, otherwise the site default. */
export const effectiveRate = (category: Pick<CategoryLimits, 'ratePerMinute'> | null, fallback: number): number => category?.ratePerMinute ?? fallback

/** The key cap: the lower of the site setting and the category's. */
export const effectiveMaxKeys = (category: Pick<CategoryLimits, 'maxKeys'> | null, siteMax: number): number =>
  category ? Math.min(category.maxKeys, siteMax) : siteMax

/** A subject (person or organisation) the admin puts in a category. */
export function validateSubject(type: unknown, id: unknown): ValidationResult<{ type: SubjectType; id: string }> {
  if (typeof type !== 'string' || !(SUBJECT_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'Choose a person or an organisation.' }
  const text = typeof id === 'number' ? String(id) : typeof id === 'string' ? id.trim() : ''
  if (text.length === 0 || text.length > 120) return { ok: false, error: 'Choose who to add.' }
  if (type === 'user' && !/^[0-9]{1,12}$/.test(text)) return { ok: false, error: 'Choose a person.' }
  return { ok: true, value: { type: type as SubjectType, id: text } }
}
