// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { expiryReminderDue, normaliseExpiryReminderDays } from '@/features/ecommerce/lib/cartLifetime'

const now = new Date('2026-11-16T00:00:00Z')
const daysAgo = (n: number): string => new Date(now.getTime() - n * 24 * 3_600_000).toISOString()

describe('cart expiry reminder', () => {
  it('is off by default and clamped below the lifetime', () => {
    expect(normaliseExpiryReminderDays({}, 30)).toBe(0)
    expect(normaliseExpiryReminderDays({ cartExpiryReminderDays: 5 }, 30)).toBe(5)
    expect(normaliseExpiryReminderDays({ cartExpiryReminderDays: 99 }, 30)).toBe(14)
    expect(normaliseExpiryReminderDays({ cartExpiryReminderDays: 9 }, 3)).toBe(2)
    expect(normaliseExpiryReminderDays({ cartExpiryReminderDays: -4 }, 30)).toBe(0)
  })
  it('is due only inside the last days before deletion, once', () => {
    const base = { lifetimeDays: 30, remindDays: 3, now }
    expect(expiryReminderDue({ ...base, updatedAt: daysAgo(10) })).toBe(false)
    expect(expiryReminderDue({ ...base, updatedAt: daysAgo(27) })).toBe(true)
    expect(expiryReminderDue({ ...base, updatedAt: daysAgo(29.5) })).toBe(true)
    expect(expiryReminderDue({ ...base, updatedAt: daysAgo(31) })).toBe(false)
    expect(expiryReminderDue({ ...base, updatedAt: daysAgo(28), alreadySent: daysAgo(1) })).toBe(false)
    expect(expiryReminderDue({ ...base, remindDays: 0, updatedAt: daysAgo(29) })).toBe(false)
  })
})
