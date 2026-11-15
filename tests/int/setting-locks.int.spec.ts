import { describe, expect, it } from 'vitest'

import { checkSettingLockedTree, emailLockRefusal, blockedKeys, groupFullyBlocked, guardChange, lockApplies, lockedSettings, parseSettingLock, resetToTheme, validateSettingLock, type SettingLock } from '@/features/roles/settingLocks'
import { GROUP_KEYS } from '@/views/visualEditor/designHelpers'
import { nodeKey } from '@/features/roles/locks'
import { blockStyleToCss } from '@/lib/blockStyle'

const admin = { roles: ['admin'] }
const editor = { roles: ['editor'] }
const lead = { roles: ['editor'], customRoleSlug: 'brand-lead' }
const lock = (over: Partial<SettingLock>): SettingLock => ({ scope: 'site', target: '', groups: [], keys: [], unlockRoles: [], ...over })

describe('setting locks', () => {
  it('applies by scope', () => {
    expect(lockApplies(lock({}), {})).toBe(true)
    expect(lockApplies(lock({ scope: 'block', target: 'button' }), { blockType: 'button' })).toBe(true)
    expect(lockApplies(lock({ scope: 'block', target: 'button' }), { blockType: 'text' })).toBe(false)
    expect(lockApplies(lock({ scope: 'template', target: '7' }), { templateId: '7' })).toBe(true)
    expect(lockApplies(lock({ scope: 'template', target: '7' }), {})).toBe(false)
    expect(lockApplies(lock({ scope: 'email', target: '' }), { emailKey: 'welcome' })).toBe(true)
  })
  it('locks single keys and whole groups, and blocks only people who cannot unlock', () => {
    const locks = [lock({ groups: ['typography'] }), lock({ keys: ['bgColor'], unlockRoles: ['brand-lead'] })]
    const forEditor = lockedSettings(locks, {}, editor, GROUP_KEYS)
    expect(forEditor.fontSize).toEqual({ blocked: true, scope: 'site' })
    expect(forEditor.bgColor.blocked).toBe(true)
    expect(lockedSettings(locks, {}, lead, GROUP_KEYS).bgColor.blocked).toBe(false)
    expect(lockedSettings(locks, {}, lead, GROUP_KEYS).fontSize.blocked).toBe(true)
    expect(blockedKeys(lockedSettings(locks, {}, admin, GROUP_KEYS))).toEqual([])
    expect(groupFullyBlocked(GROUP_KEYS.typography, blockedKeys(forEditor))).toBe(true)
    expect(groupFullyBlocked(GROUP_KEYS.spacing, blockedKeys(forEditor))).toBe(false)
  })
  it('a malformed lock locks everything for admins only', () => {
    const bad = parseSettingLock({ scope: 'nonsense' })
    expect(bad.malformed).toBe(true)
    const all = lockedSettings([bad], {}, lead, GROUP_KEYS, ['a', 'b'])
    expect(all.a.blocked && all.b.blocked).toBe(true)
    expect(lockedSettings([bad], {}, admin, GROUP_KEYS, ['a']).a.blocked).toBe(false)
  })
  it('guard puts a locked value back after any edit', () => {
    const prev: Record<string, unknown> = { fontSize: 18, bgColor: '#fff' }
    expect(guardChange(prev, { fontSize: 40, bgColor: '#000' }, ['fontSize'])).toEqual({ fontSize: 18, bgColor: '#000' })
    expect(guardChange({}, { fontSize: 40 }, ['fontSize'])).toEqual({})
    expect(guardChange(prev, { fontSize: 40 }, [])).toEqual({ fontSize: 40 })
  })
  it('reset removes the override so the theme applies, except where locked', () => {
    const style = { fontSize: 40, fontWeight: 700, bgColor: '#123456' }
    const reset = resetToTheme(style, GROUP_KEYS.typography, ['fontWeight'])
    expect(reset).toEqual({ fontWeight: 700, bgColor: '#123456' })
    expect(Object.keys(blockStyleToCss(reset as never))).not.toContain('fontSize')
  })
  it('validates a lock from the admin screen', () => {
    expect(validateSettingLock({ scope: 'block', target: '', groups: ['typography'] }).ok).toBe(false)
    expect(validateSettingLock({ scope: 'site', target: '', groups: [], keys: [] }).ok).toBe(false)
    expect(validateSettingLock({ scope: 'site', target: '', keys: ['fontSize'] }).ok).toBe(true)
  })
  it('applies to the email builder: a locked subject refuses people who cannot unlock it', () => {
    const locks = [lock({ scope: 'email', target: 'welcome', keys: ['subject'], unlockRoles: ['brand-lead'] })]
    expect(emailLockRefusal(locks, 'welcome', editor as never, ['subject', 'blocks'])).toMatch(/subject/)
    expect(emailLockRefusal(locks, 'welcome', lead as never, ['subject', 'blocks'])).toBeNull()
    expect(emailLockRefusal(locks, 'welcome', admin as never, ['subject'])).toBeNull()
    expect(emailLockRefusal(locks, 'other', editor as never, ['subject'])).toBeNull()
    expect(emailLockRefusal(locks, '', editor as never, ['brand'])).toBeNull()
  })
  it('the server refuses a saved change to a locked setting, but allows other changes and new blocks', () => {
    const tree = (fontSize: number, extra: unknown[] = []) => [
      { id: 1, blockType: 'section', design: { fontSize }, columns: [{ _id: 'c1', blocks: [{ _id: 'b1', blockType: 'button', design: { fontSize, bgColor: '#111' } }, ...extra] }] },
    ]
    const args = { locks: [lock({ scope: 'block', target: 'button', keys: ['fontSize'] })], user: editor as never, groupKeys: GROUP_KEYS, allKeys: [] as string[], nodeKeyOf: nodeKey }
    expect(checkSettingLockedTree({ ...args, original: tree(16), incoming: tree(30) })).toMatchObject({ ok: false })
    expect(checkSettingLockedTree({ ...args, original: tree(16), incoming: tree(16) })).toEqual({ ok: true })
    expect(checkSettingLockedTree({ ...args, original: tree(16), incoming: tree(16, [{ _id: 'b2', blockType: 'button', design: { fontSize: 99 } }]) })).toEqual({ ok: true })
    expect(checkSettingLockedTree({ ...args, user: admin as never, original: tree(16), incoming: tree(30) })).toEqual({ ok: true })
  })
})
