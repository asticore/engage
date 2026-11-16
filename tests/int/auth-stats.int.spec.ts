import { describe, expect, it } from 'vitest'

import { buildAuthStats } from '@/features/security/authStats'

describe('auth stats', () => {
  const now = new Date('2026-11-16T12:00:00Z')
  it('counts failures per day and methods', () => {
    const s = buildAuthStats(
      [
        { action: 'login.failed', created_at: '2026-11-16T01:00:00Z' },
        { action: 'login.failed', created_at: '2026-11-15T01:00:00Z' },
        { action: 'login.success', created_at: '2026-11-16T02:00:00Z' },
        { action: 'social.login', created_at: '2026-11-16T03:00:00Z' },
        { action: 'social.login', created_at: '2026-11-16T04:00:00Z' },
        { action: 'login.failed', created_at: '2026-01-01T00:00:00Z' },
        { action: 'user.update', created_at: '2026-11-16T05:00:00Z' },
      ],
      7,
      now,
    )
    expect(s.days).toHaveLength(7)
    expect(s.failedTotal).toBe(2)
    expect(s.successTotal).toBe(3)
    expect(s.methods[0]).toMatchObject({ id: 'social.login', count: 2 })
    expect(s.days.at(-1)).toMatchObject({ day: '2026-11-16', failed: 1, success: 3 })
  })
  it('handles an empty log', () => {
    const s = buildAuthStats([], 3, now)
    expect(s.methods).toEqual([])
    expect(s.failedTotal).toBe(0)
  })
})
