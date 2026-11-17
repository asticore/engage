import { describe, expect, it } from 'vitest'

import { portalCanOpen } from '@/features/quotes/logic'

const now = new Date('2026-11-17T00:00:00Z')
const quote = (status: string, validUntil: string | null = '2026-12-01T00:00:00Z', totalCents: number | null = 5000) => ({ status, validUntil, totalCents })

describe('account page quote link (12c)', () => {
  it('offers Open quote for a quote that is waiting or accepted', () => {
    expect(portalCanOpen(quote('quoted'), now)).toBe(true)
    expect(portalCanOpen(quote('countered'), now)).toBe(true)
    expect(portalCanOpen(quote('accepted'), now)).toBe(true)
  })
  it('does not offer it without a quote, or once expired, declined or closed', () => {
    expect(portalCanOpen(quote('new', null, null), now)).toBe(false)
    expect(portalCanOpen(quote('quoted', '2026-11-01T00:00:00Z'), now)).toBe(false)
    expect(portalCanOpen(quote('expired'), now)).toBe(false)
    expect(portalCanOpen(quote('declined'), now)).toBe(false)
    expect(portalCanOpen(quote('closed'), now)).toBe(false)
  })
})
