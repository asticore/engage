import { describe, expect, it } from 'vitest'

import { centsOf, effectiveStatus, hashToken, isQuoteToken, newQuoteNumber, newQuoteToken, parseCounter, parseQuote, parseRequest, renderQuoteEmail, totalCents } from '@/features/quotes/logic'

describe('quote request rules', () => {
  it('reads money typed by a person', () => {
    expect(centsOf('$1,200.50')).toBe(120050)
    expect(centsOf('12')).toBe(1200)
    expect(centsOf('abc')).toBeNull()
    expect(centsOf(-1)).toBeNull()
  })
  it('validates a request and a bid', () => {
    expect(parseRequest({ name: '', email: 'a@b.co', details: 'x' }).ok).toBe(false)
    expect(parseRequest({ name: 'Ada', email: 'nope', details: 'x' }).ok).toBe(false)
    expect(parseRequest({ name: 'Ada', email: 'a@b.co' }).ok).toBe(false) // a quote needs details
    const ok = parseRequest({ name: ' Ada ', email: ' ADA@Example.com ', details: 'Ten chairs', quantity: '10', deadline: '2026-12-01' })
    expect(ok.ok && ok.value).toMatchObject({ kind: 'quote', name: 'Ada', email: 'ada@example.com', quantity: 10, deadline: '2026-12-01', offerCents: null })
    expect(parseRequest({ kind: 'bid', name: 'Ada', email: 'a@b.co' }).ok).toBe(false) // a bid needs an amount
    const bid = parseRequest({ kind: 'bid', name: 'Ada', email: 'a@b.co', offer: '250' })
    expect(bid.ok && bid.value.offerCents).toBe(25000)
    expect(parseRequest({ name: 'Ada', email: 'a@b.co', details: 'x', deadline: 'soon' }).ok).toBe(false)
  })
  it('builds a quote with a validity date', () => {
    const now = new Date('2026-03-01T00:00:00Z')
    expect(parseQuote({ lines: [] }, now).ok).toBe(false)
    expect(parseQuote({ lines: [{ description: 'Chair', quantity: 2, unit: 'x' }] }, now).ok).toBe(false)
    expect(parseQuote({ lines: [{ description: 'Free', quantity: 1, unit: '0' }] }, now).ok).toBe(false)
    const q = parseQuote({ lines: [{ description: 'Chair', quantity: 2, unit: '10.50' }, { description: 'Delivery', quantity: 1, unit: '15' }], validDays: 7, terms: 'Net 7' }, now)
    expect(q.ok && totalCents(q.value.lines)).toBe(3600)
    expect(q.ok && q.value.validUntil).toBe('2026-03-08T00:00:00.000Z')
  })
  it('reads a counter-offer', () => {
    expect(parseCounter({}).ok).toBe(false)
    expect(parseCounter({ amount: '0' }).ok).toBe(false)
    const c = parseCounter({ note: 'Lower please', amount: '30' })
    expect(c.ok && c.value).toEqual({ note: 'Lower please', cents: 3000 })
  })
  it('closes quotes after their date', () => {
    const now = new Date('2026-03-10T00:00:00Z')
    expect(effectiveStatus('quoted', '2026-03-08T00:00:00.000Z', now)).toBe('expired')
    expect(effectiveStatus('quoted', '2026-03-12T00:00:00.000Z', now)).toBe('quoted')
    expect(effectiveStatus('accepted', '2026-03-08T00:00:00.000Z', now)).toBe('accepted')
  })
  it('fills merge tags once and keeps private links hashed', async () => {
    const mail = renderQuoteEmail('quote', { name: 'Ada', number: 'QR-1', total: '$36.00', validUntil: '8 March', link: 'https://x/quote/t', siteName: 'Shop' }, 'Hi {{name}}, your total is {{total}}.')
    expect(mail.subject).toBe('Your quote QR-1 from Shop')
    expect(mail.text).toContain('Hi Ada, your total is $36.00.')
    expect(mail.text).toContain('https://x/quote/t')
    const sneaky = renderQuoteEmail('received', { name: '{{number}}', number: 'QR-2', kindLabel: 'quote request', siteName: 'S' })
    expect(sneaky.text).toContain('Hi {{number}}')
    const token = newQuoteToken()
    expect(isQuoteToken(token)).toBe(true)
    expect(await hashToken(token)).toHaveLength(64)
    expect(newQuoteNumber()).toMatch(/^QR-[0-9A-Z]{6}$/)
  })
})
