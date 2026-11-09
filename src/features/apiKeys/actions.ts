'use server'

import { refuseWhileImpersonating } from '@/features/impersonation/policy'
import { headers } from 'next/headers'

import { reauthenticate } from '@/features/accounts/passkeysWiring'
import { resolveD1Binding } from '@/cms/db/connect'
import { audit, auditContext } from '@/features/security/auditLog'
import { hit } from '@/features/security/rateLimit'
import { getSecuritySettings, type SecuritySettings } from '@/features/security/settings'
import { getEngine } from '@/lib/engine'

import { createD1CategoryStore, createD1UsageStore, usageDay, type CategoryMember, type KeyUsageDay } from './categoryStore'
import { validateCategory, validateSubject, type ApiCategory, type CategoryLimits } from './categories'
import { createD1ApiKeyStore, createApiKey, isActive, listApiKeys, revokeApiKey, rotateApiKey, type ApiKeyDeps, type ApiKeyRow, type D1Like, type LiveOwner } from './index'
import { isStaffRoles, scopableCollections, type ScopeCollection } from './core'

/**
 * What the API key screens call. The signed-in person is always the cookie session's own:
 * `engine.auth` is called without the `apiKeys` option, so a bearer key in the request
 * resolves to no user here and every action refuses. Creating a key re-checks the password
 * or the two-step code, like passkey registration. Only the key's hash is stored; the full
 * key is returned once, to the caller that created it.
 */

export type ApiKeyView = {
  id: number
  userId: number
  ownerEmail: string | null
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  active: boolean
}

export type ApiKeyActionResult = { ok: boolean; error?: string; key?: string; keys?: ApiKeyView[] }

type Actor = { id: number; email: string; roles: string[]; isAdmin: boolean }

const CREATES_PER_HOUR = 10

const d1 = async (): Promise<D1Like> => (await resolveD1Binding()) as unknown as D1Like
const categoryStore = () => createD1CategoryStore(d1)
const usageStore = () => createD1UsageStore(d1)

async function session(): Promise<{ actor: Actor; settings: SecuritySettings; deps: ApiKeyDeps; engineUser: unknown } | null> {
  const engine = await getEngine()
  const incoming = await headers()
  const { user } = await engine.auth({ headers: incoming }).catch((): { user: null } => ({ user: null }))
  if (!user) return null
  const doc = user as unknown as { id: number; email: string; roles?: string[] }
  const settings = await getSecuritySettings(engine as never)
  const origin = auditContext(new Request('https://engage.local', { headers: incoming }))
  const deps: ApiKeyDeps = {
    store: createD1ApiKeyStore(async () => (await resolveD1Binding()) as unknown as D1Like),
    now: () => Date.now(),
    loadCategory: (userId) => categoryStore().categoryForUser(userId),
    categoriesExist: async () => (await categoryStore().count()) > 0,
    audit: async (entry) => {
      try {
        await audit({ ...entry, collectionSlug: 'api-keys', ...origin }, settings)
      } catch {
        // A log line never fails the action.
      }
    },
    loadOwner: async (userId) => {
      const row = (await engine.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true }).catch((): null => null)) as
        | { id: number; email: string; roles?: string[] }
        | null
      if (!row) return null
      return { id: row.id, email: row.email, roles: row.roles ?? [], locked: false, user: row }
    },
  }
  const roles = doc.roles ?? []
  const actor: Actor = { id: Number(doc.id), email: String(doc.email ?? ''), roles, isAdmin: roles.includes('admin') }
  return { actor, settings, deps, engineUser: user }
}

async function emailsFor(userIds: number[]): Promise<Map<number, string>> {
  const engine = await getEngine()
  const out = new Map<number, string>()
  for (const id of [...new Set(userIds)]) {
    const row = (await engine.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch((): null => null)) as { email?: string } | null
    if (row?.email) out.set(id, row.email)
  }
  return out
}

const toViews = async (rows: ApiKeyRow[], now: number): Promise<ApiKeyView[]> => {
  const emails = await emailsFor(rows.map((r) => r.userId))
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    ownerEmail: emails.get(row.userId) ?? null,
    name: row.name,
    prefix: row.prefix,
    scopes: [...row.scopes],
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    active: isActive(row, now),
  }))
}

const myKeys = async (s: NonNullable<Awaited<ReturnType<typeof session>>>): Promise<ApiKeyView[]> =>
  toViews(await listApiKeys(s.deps.store, { userId: s.actor.id }), s.deps.now())

/** The signed-in person's own keys. */
export async function listMyApiKeys(): Promise<ApiKeyActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: 'Sign in to see your API keys.' }
  return { ok: true, keys: await myKeys(s) }
}

/** Every key on the site, for an admin. Anyone else is refused. */
export async function listAllApiKeys(): Promise<ApiKeyActionResult> {
  const s = await session()
  if (!s) return { ok: false, error: 'Sign in to see API keys.' }
  if (!s.actor.isAdmin) return { ok: false, error: 'Only admins can see every key.' }
  return { ok: true, keys: await toViews(await listApiKeys(s.deps.store, 'all'), s.deps.now()) }
}

export async function createMyApiKey(input: { name: string; scopes: string[]; expiresInDays?: string; password?: string; code?: string }): Promise<ApiKeyActionResult> {  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return { ok: false, error: blocked }

  const s = await session()
  if (!s) return { ok: false, error: 'Sign in to create an API key.' }
  if (!s.settings.apiKeys.enabled) return { ok: false, error: 'API keys are not turned on for this site.' }
  if (!isStaffRoles(s.actor.roles) && !s.settings.apiKeys.allowCustomers) {
    return { ok: false, error: 'API keys are not available to customers on this site.' }
  }
  if (!(await reauthenticate(s.actor.id, { password: input.password, code: input.code }))) {
    return { ok: false, error: 'Enter your current password or a two-step code to create a key.' }
  }
  if (hit(`api-keys:create:${s.actor.id}`, CREATES_PER_HOUR).limited) {
    return { ok: false, error: 'Too many keys created recently. Try again in a little while.' }
  }
  const owner: LiveOwner = { id: s.actor.id, email: s.actor.email, roles: s.actor.roles, locked: false, user: s.engineUser }
  const expiresInDays = input.expiresInDays && input.expiresInDays.trim() !== '' ? Number(input.expiresInDays) : undefined
  const created = await createApiKey(s.deps, owner, { name: input.name, scopes: input.scopes, expiresInDays }, s.settings.apiKeys, { id: s.actor.id, email: s.actor.email })
  if (created.ok === false) return { ok: false, error: created.error }
  return { ok: true, key: created.value.key, keys: await myKeys(s) }
}

/** Revokes one key. The owner may revoke their own; an admin may revoke any (audited). */
export async function revokeApiKeyAction(keyId: number): Promise<ApiKeyActionResult> {  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return { ok: false, error: blocked }

  const s = await session()
  if (!s) return { ok: false, error: 'Sign in to revoke a key.' }
  const result = await revokeApiKey(s.deps, { id: s.actor.id, email: s.actor.email, isAdmin: s.actor.isAdmin }, Number(keyId))
  if (result.ok === false) return { ok: false, error: result.error }
  const keys = s.actor.isAdmin ? await toViews(await listApiKeys(s.deps.store, 'all'), s.deps.now()) : await myKeys(s)
  return { ok: true, keys }
}

/** The collections the scope picker offers, from the live config. Empty when nobody is signed in. */
export async function apiKeyScopeChoicesAction(): Promise<ScopeCollection[]> {
  const s = await session()
  if (!s) return []
  const engine = await getEngine()
  return scopableCollections(engine.config.collections as unknown as Array<{ slug?: unknown; labels?: { plural?: unknown } | null }>)
}

/** Replaces one of the signed-in person's keys (an admin may replace anyone's). The new key is shown once. */
export async function rotateApiKeyAction(keyId: number, input: { password?: string; code?: string } = {}): Promise<ApiKeyActionResult> {
  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return { ok: false, error: blocked }
  const s = await session()
  if (!s) return { ok: false, error: 'Sign in to rotate a key.' }
  if (!s.settings.apiKeys.enabled) return { ok: false, error: 'API keys are not turned on for this site.' }
  if (!(await reauthenticate(s.actor.id, { password: input.password, code: input.code }))) {
    return { ok: false, error: 'Enter your current password or a two-step code to rotate a key.' }
  }
  const row = await s.deps.store.findById(Number(keyId))
  if (!row || (row.userId !== s.actor.id && !s.actor.isAdmin)) return { ok: false, error: 'No such key.' }
  const owner = await s.deps.loadOwner(row.userId)
  if (!owner) return { ok: false, error: 'No such key.' }
  const rotated = await rotateApiKey(s.deps, owner, { id: s.actor.id, email: s.actor.email, isAdmin: s.actor.isAdmin }, row.id, s.settings.apiKeys)
  if (rotated.ok === false) return { ok: false, error: rotated.error }
  const keys = s.actor.isAdmin ? await toViews(await listApiKeys(s.deps.store, 'all'), s.deps.now()) : await myKeys(s)
  return { ok: true, key: rotated.value.key, keys }
}

export type KeyUsageResult = { ok: boolean; error?: string; days?: KeyUsageDay[] }

/** The last 30 days of requests for one key. The owner sees their own; an admin sees any. */
export async function keyUsageAction(keyId: number): Promise<KeyUsageResult> {
  const s = await session()
  if (!s) return { ok: false, error: 'Sign in to see usage.' }
  const row = await s.deps.store.findById(Number(keyId))
  if (!row || (row.userId !== s.actor.id && !s.actor.isAdmin)) return { ok: false, error: 'No such key.' }
  const since = usageDay(s.deps.now() - 29 * 86_400_000)
  return { ok: true, days: await usageStore().forKey(row.id, since) }
}

export type CategoryView = ApiCategory & { members: Array<CategoryMember & { label: string }> }
export type CategoryActionResult = { ok: boolean; error?: string; categories?: CategoryView[] }

async function adminSession() {
  const s = await session()
  if (!s) return { error: 'Sign in to manage API access categories.' as const }
  if (!s.actor.isAdmin) return { error: 'Only admins can manage API access categories.' as const }
  return { s }
}

async function labelsFor(members: CategoryMember[]): Promise<Map<string, string>> {
  const engine = await getEngine()
  const out = new Map<string, string>()
  for (const m of members) {
    const key = `${m.subjectType}:${m.subjectId}`
    if (out.has(key)) continue
    if (m.subjectType === 'user') {
      const row = (await engine.findByID({ collection: 'users', id: Number(m.subjectId), depth: 0, overrideAccess: true }).catch((): null => null)) as { email?: string } | null
      out.set(key, row?.email ?? `User ${m.subjectId}`)
    } else {
      try {
        const row = await (await d1()).prepare('SELECT name FROM `eg_organizations` WHERE id = ?').bind(m.subjectId).first<{ name: string }>()
        out.set(key, row?.name ?? `Organisation ${m.subjectId}`)
      } catch {
        out.set(key, `Organisation ${m.subjectId}`)
      }
    }
  }
  return out
}

async function categoryViews(): Promise<CategoryView[]> {
  const store = categoryStore()
  const list = await store.list()
  const out: CategoryView[] = []
  for (const category of list) {
    const members = await store.members(category.id)
    const labels = await labelsFor(members)
    out.push({ ...category, members: members.map((m) => ({ ...m, label: labels.get(`${m.subjectType}:${m.subjectId}`) ?? m.subjectId })) })
  }
  return out
}

const categoryAudit = async (s: NonNullable<Awaited<ReturnType<typeof session>>>, detail: string, documentId?: number): Promise<void> => {
  await s.deps.audit({ action: 'api-category.changed', actorId: s.actor.id, actorEmail: s.actor.email, documentId: documentId ?? null, detail }).catch((): void => undefined)
}

export async function listApiCategoriesAction(): Promise<CategoryActionResult> {
  const a = await adminSession()
  if ('error' in a) return { ok: false, error: a.error }
  return { ok: true, categories: await categoryViews() }
}

export async function saveApiCategoryAction(input: { id?: number; name: string; description?: string; scopes: string[]; ratePerMinute?: number | string; maxKeys?: number | string }): Promise<CategoryActionResult> {
  const a = await adminSession()
  if ('error' in a) return { ok: false, error: a.error }
  const checked = validateCategory(input)
  if (checked.ok === false) return { ok: false, error: checked.error }
  const store = categoryStore()
  const at = new Date(a.s.deps.now()).toISOString()
  try {
    if (input.id) {
      if (!(await store.findById(Number(input.id)))) return { ok: false, error: 'No such category.' }
      await store.update(Number(input.id), checked.value, at)
      await categoryAudit(a.s, `updated "${checked.value.name}"`, Number(input.id))
    } else {
      if ((await store.list()).length >= 100) return { ok: false, error: 'A site can have at most 100 categories.' }
      const id = await store.insert(checked.value, at)
      await categoryAudit(a.s, `created "${checked.value.name}"`, id)
    }
  } catch {
    return { ok: false, error: 'A category with that name already exists.' }
  }
  return { ok: true, categories: await categoryViews() }
}

export async function deleteApiCategoryAction(id: number): Promise<CategoryActionResult> {
  const a = await adminSession()
  if ('error' in a) return { ok: false, error: a.error }
  const store = categoryStore()
  const found = await store.findById(Number(id))
  if (!found) return { ok: false, error: 'No such category.' }
  await store.remove(found.id)
  await categoryAudit(a.s, `deleted "${found.name}"`, found.id)
  return { ok: true, categories: await categoryViews() }
}

/** Adds a person (by email) or an organisation (by id) to a category. */
export async function assignApiCategoryAction(input: { categoryId: number; subjectType: string; subject: string }): Promise<CategoryActionResult> {
  const a = await adminSession()
  if ('error' in a) return { ok: false, error: a.error }
  const store = categoryStore()
  const category = await store.findById(Number(input.categoryId))
  if (!category) return { ok: false, error: 'No such category.' }
  let subjectId = input.subject
  if (input.subjectType === 'user' && input.subject.includes('@')) {
    const engine = await getEngine()
    const found = await engine.find({ collection: 'users', where: { email: { equals: input.subject.trim().toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true }).catch((): null => null)
    const doc = found?.docs?.[0] as { id?: number } | undefined
    if (!doc?.id) return { ok: false, error: 'No account with that email.' }
    subjectId = String(doc.id)
  }
  const subject = validateSubject(input.subjectType, subjectId)
  if (subject.ok === false) return { ok: false, error: subject.error }
  await store.assign(category.id, subject.value.type, subject.value.id, new Date(a.s.deps.now()).toISOString())
  await categoryAudit(a.s, `added ${subject.value.type} ${subject.value.id} to "${category.name}"`, category.id)
  return { ok: true, categories: await categoryViews() }
}

export async function unassignApiCategoryAction(memberId: number): Promise<CategoryActionResult> {
  const a = await adminSession()
  if ('error' in a) return { ok: false, error: a.error }
  await categoryStore().unassign(Number(memberId))
  await categoryAudit(a.s, `removed member ${memberId} from a category`)
  return { ok: true, categories: await categoryViews() }
}

/** The signed-in person's own category and what it allows, for the portal. Null when none. */
export async function myApiCategoryAction(): Promise<{ ok: boolean; category: CategoryLimits | null; required: boolean }> {
  const s = await session()
  if (!s) return { ok: false, category: null, required: false }
  const category = await categoryStore().categoryForUser(s.actor.id)
  const required = !category && !isStaffRoles(s.actor.roles) && (await categoryStore().count()) > 0
  return { ok: true, category, required }
}

/**
 * An admin makes a key for a customer. The key belongs to that customer's account and is limited by
 * their access category exactly as if they had made it. Shown once to the admin, who hands it over.
 * Re-checks the admin's own password or two-step code. Audited with the admin as the actor.
 */
export async function createApiKeyForUserAction(input: { email: string; name: string; scopes: string[]; expiresInDays?: string; password?: string; code?: string }): Promise<ApiKeyActionResult> {
  const blocked = refuseWhileImpersonating(await headers())
  if (blocked) return { ok: false, error: blocked }
  const a = await adminSession()
  if ('error' in a) return { ok: false, error: a.error }
  const { s } = a
  if (!s.settings.apiKeys.enabled) return { ok: false, error: 'API keys are not turned on for this site.' }
  if (!(await reauthenticate(s.actor.id, { password: input.password, code: input.code }))) {
    return { ok: false, error: 'Enter your own current password or a two-step code to create a key.' }
  }
  if (hit(`api-keys:create:${s.actor.id}`, CREATES_PER_HOUR).limited) {
    return { ok: false, error: 'Too many keys created recently. Try again in a little while.' }
  }
  const engine = await getEngine()
  const found = await engine.find({ collection: 'users', where: { email: { equals: String(input.email ?? '').trim().toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true }).catch((): null => null)
  const doc = found?.docs?.[0] as { id?: number } | undefined
  if (!doc?.id) return { ok: false, error: 'No account with that email.' }
  const owner = await s.deps.loadOwner(Number(doc.id))
  if (!owner) return { ok: false, error: 'No account with that email.' }
  const expiresInDays = input.expiresInDays && input.expiresInDays.trim() !== '' ? Number(input.expiresInDays) : undefined
  const created = await createApiKey(s.deps, owner, { name: input.name, scopes: input.scopes, expiresInDays }, s.settings.apiKeys, { id: s.actor.id, email: s.actor.email })
  if (created.ok === false) return { ok: false, error: created.error }
  return { ok: true, key: created.value.key, keys: await toViews(await listApiKeys(s.deps.store, 'all'), s.deps.now()) }
}
