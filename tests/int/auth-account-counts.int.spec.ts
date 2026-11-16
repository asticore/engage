import { describe, expect, it } from 'vitest'

import { loadAccountCounts } from '@/features/security/authStats'

const fake = (n: number, fail = false) => ({
  prepare: () => ({ bind: () => ({ all: async () => (fail ? Promise.reject(new Error('x')) : { results: [{ n }] }) }) }),
})

describe('account counts', () => {
  it('reads sign-ups and active sessions', async () => {
    expect(await loadAccountCounts(fake(7), 30, new Date('2026-11-16T00:00:00Z'))).toEqual({ signUps: 7, activeSessions: 7 })
  })
  it('returns null when the tables cannot be read', async () => {
    expect(await loadAccountCounts(fake(0, true), 30, new Date())).toBeNull()
  })
})
