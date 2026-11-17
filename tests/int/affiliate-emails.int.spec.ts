import { describe, expect, it } from 'vitest'

import { approvedEmail, commissionEmail, payableEmail, payoutEmail } from '@/features/affiliates/emails'
import { loadStrings } from '@/features/uiStrings/t'

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
  it('payable email says the waiting period is over', () => {
    const m = payableEmail({ name: 'Sam', orderId: 9, amountCents: 2500, dashboard: 'https://x.com/d' })
    expect(m.subject).toContain('$25.00')
    expect(m.text).toContain('order #9')
    expect(m.text).toContain('https://x.com/d')
  })
  it('is written in another language when given its strings, with every value filled in', async () => {
    const de = await loadStrings('de')
    const m = approvedEmail({ name: 'Sam', link: 'https://x.com/?ref=sam', dashboard: 'https://x.com/d', commissionPct: 12, cookieDays: 30 }, de)
    expect(m.subject).toBe('Du wurdest als Partner freigegeben')
    expect(m.text).toContain('12% Provision')
    expect(m.text).not.toMatch(/\{\w+\}/)
    const p = payoutEmail({ name: 'Sam', amountCents: 500, note: 'PAY-1', dashboard: 'd' }, de)
    expect(p.text).toContain('Referenz: PAY-1.')
    expect(p.text).not.toMatch(/\{\w+\}/)
  })
})
