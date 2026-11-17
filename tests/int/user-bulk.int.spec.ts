import { describe, expect, it } from 'vitest'

import { MAX_USER_BULK, parseUserBulk, userBulkRefusal } from '@/features/security/userBulk'

describe('bulk user actions', () => {
  it('parses and validates', () => {
    expect(parseUserBulk({ action: 'x', ids: [1] }).ok).toBe(false)
    expect(parseUserBulk({ action: 'ban', ids: [] }).ok).toBe(false)
    expect(parseUserBulk({ action: 'ban', ids: Array.from({ length: MAX_USER_BULK + 1 }, (_, i) => i + 1) }).ok).toBe(false)
    expect(parseUserBulk({ action: 'ban', ids: [1], days: 0 }).ok).toBe(false)
    expect(parseUserBulk({ action: 'setRole', ids: [1], role: 'admin' }).ok).toBe(false)
    const ok = parseUserBulk({ action: 'ban', ids: [2, 2, '3'], days: '7', reason: ' spam ' })
    expect(ok).toMatchObject({ ok: true, ids: [2, 3], days: 7, reason: 'spam' })
  })
  it('protects self, admins and customers', () => {
    expect(userBulkRefusal('ban', { id: 1, roles: ['editor'] }, 1)).not.toBeNull()
    expect(userBulkRefusal('ban', { id: 2, roles: ['admin'] }, 1)).not.toBeNull()
    expect(userBulkRefusal('unban', { id: 2, roles: ['admin'] }, 1)).toBeNull()
    expect(userBulkRefusal('ban', { id: 2, roles: ['customer'] }, 1)).not.toBeNull()
    expect(userBulkRefusal('setRole', { id: 2, roles: ['viewer'] }, 1)).toBeNull()
  })
})
