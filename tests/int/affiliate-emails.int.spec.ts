import { describe, expect, it } from 'vitest'

import { approvedEmail, commissionEmail, payoutEmail } from '@/features/affiliates/emails'

describe('affiliate emails', () => {
  it('approved email carries the link, rate and private results page', () => {
    const m = approvedEmail({ name: 'Sam', link: 'https://x.com/?ref=sam', dashboard: 'https://x.com/affiliates/dashboard?token=t', commissionPct: 12, cookieDays: 30 })
    expect(m.text).toContain('12% commission')
    expect(m.text).toContain('https://x.com/?ref=sam')
    expect(m.text).toContain('token=t')
  })
  it('commission and payout emails show dollars and dates', () => {
    const c = commissionEmail({ name: 'Sam', orderId: 7, amountCents: 1234, payableOn: '2026-12-16T00:00:00.000Z', dashboard: 'd' })
    expect(c.subject).toContain('$12.34')
    expect(c.text).toContain('order #7')
    expect(c.text).toContain('2026-12-16')
    const p = payoutEmail({ name: 'Sam', amountCents: 500, note: 'PAY-1', dashboard: 'd' })
    expect(p.subject).toContain('$5.00')
    expect(p.text).toContain('Reference: PAY-1.')
  })
})
