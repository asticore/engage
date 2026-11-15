/**
 * Setting locks: lock single design settings (or whole groups such as Typography) so editors cannot change them.
 * Elementor style. A lock applies site wide, to one kind of block (for example every button), or to one template.
 * Pure: no database, no React. The visual editor uses it to show lock icons and refuse edits; the email builder
 * uses the same model with `scope: 'email'`. Everything fails closed: an unreadable entry locks its scope for admins only.
 *
 * Reset to default: clearing a setting removes the override, so the theme (design token) value shows again.
 * A locked setting cannot be reset by a person who cannot unlock it.
 */

import { canBypassLock, type LockUser } from './locks'

export type SettingLockScope = 'site' | 'block' | 'template' | 'email'

export type SettingLock = {
  id?: number
  scope: SettingLockScope
  /** Block type for `block`, template id for `template`, email template key for `email`, empty for `site`. */
  target: string
  /** Design groups (typography, spacing...) whose settings are all locked. */
  groups: string[]
  /** Single setting keys (fontSize, bgColor...). */
  keys: string[]
  unlockRoles: string[]
  malformed?: boolean
}

export type LockContext = { blockType?: string; templateId?: string; emailKey?: string }

const SCOPES: SettingLockScope[] = ['site', 'block', 'template', 'email']
const list = (v: unknown, max = 200): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80).slice(0, max) : [])

/** One stored lock, cleaned. An unknown scope or a shape that is not an object is a malformed lock that locks everything for admins only. */
export function parseSettingLock(raw: unknown): SettingLock {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null
  if (!r || !SCOPES.includes(r.scope as SettingLockScope)) return { scope: 'site', target: '', groups: ['*'], keys: [], unlockRoles: [], malformed: true }
  const id = Number(r.id)
  return {
    ...(Number.isInteger(id) && id > 0 ? { id } : {}),
    scope: r.scope as SettingLockScope,
    target: typeof r.target === 'string' ? r.target.slice(0, 80) : '',
    groups: list(r.groups, 40),
    keys: list(r.keys),
    unlockRoles: list(r.unlockRoles, 50),
  }
}

export const parseSettingLocks = (raw: unknown): SettingLock[] => (Array.isArray(raw) ? raw.slice(0, 500).map(parseSettingLock) : [])

/** Whether a lock covers this place: site wide, or its block type, template or email key matches. */
export function lockApplies(lock: SettingLock, ctx: LockContext): boolean {
  switch (lock.scope) {
    case 'site':
      return true
    case 'block':
      return Boolean(ctx.blockType) && lock.target === ctx.blockType
    case 'template':
      return Boolean(ctx.templateId) && lock.target === ctx.templateId
    case 'email':
      return Boolean(ctx.emailKey) && (lock.target === '' || lock.target === ctx.emailKey)
  }
}

export type LockedSetting = { blocked: boolean; scope: SettingLockScope }

/**
 * Every setting key that is locked here and what that means for this person.
 * `groupKeys` maps a group name to its keys (the Design panel's GROUP_KEYS); the group `*` means everything the person edits.
 * `allKeys` is only needed for `*`.
 */
export function lockedSettings(
  locks: SettingLock[],
  ctx: LockContext,
  user: LockUser,
  groupKeys: Record<string, readonly string[]>,
  allKeys: readonly string[] = [],
): Record<string, LockedSetting> {
  const out: Record<string, LockedSetting> = {}
  for (const lock of locks) {
    if (!lockApplies(lock, ctx)) continue
    const blocked = !canBypassLock(user, { mode: 'full', unlockRoles: lock.unlockRoles, editableProps: [], malformed: lock.malformed })
    const keys = new Set<string>(lock.keys)
    for (const g of lock.groups) for (const k of g === '*' ? allKeys : groupKeys[g] ?? []) keys.add(k)
    for (const key of keys) {
      const existing = out[key]
      // Two locks on one setting: it stays blocked if either blocks this person.
      if (!existing || (blocked && !existing.blocked)) out[key] = { blocked, scope: lock.scope }
    }
  }
  return out
}

/** The keys this person may not change. */
export const blockedKeys = (locked: Record<string, LockedSetting>): string[] => Object.keys(locked).filter((k) => locked[k].blocked)

/** Undoes any change to a blocked setting, so a locked value survives every edit path (typing, paste, presets, reset). */
export function guardChange<T extends Record<string, unknown>>(prev: T, next: T, blocked: readonly string[]): T {
  if (blocked.length === 0) return next
  const out: Record<string, unknown> = { ...next }
  for (const key of blocked) {
    if (prev[key] === undefined) delete out[key]
    else out[key] = prev[key]
  }
  return out as T
}

/** Reset to default: removes the overrides, so the theme value applies. Blocked settings are left alone. */
export function resetToTheme<T extends Record<string, unknown>>(style: T, keys: readonly string[], blocked: readonly string[] = []): T {
  const out: Record<string, unknown> = { ...style }
  for (const key of keys) if (!blocked.includes(key)) delete out[key]
  return out as T
}

/** True when every key of a group is blocked: the whole section can be shown read only. */
export const groupFullyBlocked = (keys: readonly string[], blocked: readonly string[]): boolean => keys.length > 0 && keys.every((k) => blocked.includes(k))

/** Validates a lock from the admin screen. */
export function validateSettingLock(input: unknown): { ok: true; lock: SettingLock } | { ok: false; error: string } {
  const lock = parseSettingLock(input)
  if (lock.malformed) return { ok: false, error: 'Choose where the lock applies.' }
  if ((lock.scope === 'block' || lock.scope === 'template') && !lock.target) return { ok: false, error: lock.scope === 'block' ? 'Choose the block type.' : 'Choose the template.' }
  if (lock.groups.length === 0 && lock.keys.length === 0) return { ok: false, error: 'Choose at least one setting or group to lock.' }
  return { ok: true, lock }
}

/** The parts of an email design a lock can cover. */
export const EMAIL_LOCK_KEYS = ['subject', 'blocks', 'brand'] as const

/**
 * Whether saving this email change touches a locked part the person cannot unlock, with what to tell them.
 * `touches` is what the save changes: a template save changes subject and blocks, a reset the same, a brand save the brand.
 */
export function emailLockRefusal(locks: SettingLock[], emailKey: string, user: LockUser, touches: readonly (typeof EMAIL_LOCK_KEYS)[number][]): string | null {
  const locked = lockedSettings(locks, { emailKey }, user, {}, [...EMAIL_LOCK_KEYS])
  const hit = touches.find((k) => locked[k]?.blocked)
  return hit ? `The ${hit === 'blocks' ? 'design' : hit} of this email is locked. Ask an admin to unlock it.` : null
}

type TreeNode = Record<string, unknown>
const isNode = (v: unknown): v is TreeNode => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Every node of a blocks tree with the block type it counts as, keyed by its stored id. Sections, their columns and the blocks in each column. */
function indexDesigns(blocks: unknown, nodeKeyOf: (node: unknown) => string | undefined): Map<string, { type: string; design: Record<string, unknown> }> {
  const out = new Map<string, { type: string; design: Record<string, unknown> }>()
  let left = 5000
  const visit = (node: unknown, fallbackType: string): void => {
    if (!isNode(node) || left-- <= 0) return
    const key = nodeKeyOf(node)
    const type = typeof node.elementType === 'string' && node.elementType ? node.elementType : typeof node.blockType === 'string' && node.blockType ? node.blockType : fallbackType
    if (key) out.set(key, { type, design: isNode(node.design) ? node.design : {} })
    if (Array.isArray(node.columns)) for (const column of node.columns) {
      visit(column, 'column')
      if (isNode(column) && Array.isArray(column.blocks)) for (const inner of column.blocks) visit(inner, 'block')
    }
  }
  if (Array.isArray(blocks)) for (const node of blocks) visit(node, 'section')
  return out
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * The server side of setting locks: compares the stored blocks with the blocks being saved and names the first
 * locked setting a person who cannot unlock it has changed. Only nodes that exist on both sides are compared,
 * so adding a block (or a block from a preset) is never refused.
 */
export function checkSettingLockedTree(args: {
  locks: SettingLock[]
  user: LockUser
  templateId?: string
  original: unknown
  incoming: unknown
  groupKeys: Record<string, readonly string[]>
  allKeys: readonly string[]
  nodeKeyOf: (node: unknown) => string | undefined
}): { ok: true } | { ok: false; message: string } {
  if (args.locks.length === 0) return { ok: true }
  const before = indexDesigns(args.original, args.nodeKeyOf)
  const after = indexDesigns(args.incoming, args.nodeKeyOf)
  for (const [key, was] of before) {
    const now = after.get(key)
    if (!now) continue
    const locked = lockedSettings(args.locks, { blockType: was.type, templateId: args.templateId }, args.user, args.groupKeys, args.allKeys)
    for (const setting of blockedKeys(locked)) {
      if (!same(was.design[setting], now.design[setting])) {
        return { ok: false, message: `The "${setting}" setting is locked on ${was.type} blocks and cannot be changed. Ask an admin to unlock it.` }
      }
    }
  }
  return { ok: true }
}
