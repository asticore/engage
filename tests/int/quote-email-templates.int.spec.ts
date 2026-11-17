import { describe, expect, it } from 'vitest'

import { EmailTemplates } from '@/globals/EmailTemplates'
import { EMAIL_TEMPLATE_DEFAULTS } from '@/features/email/templateDefaults'
import { sampleValuesFor, TEMPLATE_LABELS } from '@/features/email/testSamples'
import { QUOTE_EMAILS, QUOTE_TEMPLATE_KEYS, renderQuoteEmail } from '@/features/quotes/logic'
import { renderQuoteMail } from '@/features/quotes/mail'

const names = (fields: { name?: string }[]): string[] => fields.map((f) => f.name ?? '')

describe('quote emails in Email templates (12c)', () => {
  const templateKeys = Object.values(QUOTE_TEMPLATE_KEYS)
  it('has built-in wording, a wording group, a design field, a label and a test sample for every quote email', () => {
    const fields = names(EmailTemplates.fields as { name?: string }[])
    for (const key of templateKeys) {
      expect(EMAIL_TEMPLATE_DEFAULTS[key].subject).not.toBe('')
      expect(fields).toContain(key)
      expect(fields).toContain(`${key}Design`)
      expect(TEMPLATE_LABELS[key]).toBeTruthy()
      expect(Object.keys(sampleValuesFor(key)).length).toBeGreaterThan(1)
    }
  })
  it('uses wording typed in Email templates', async () => {
    const reader = { findGlobal: async (): Promise<unknown> => ({ quoteSent: { subject: 'Quote {{number}} for {{name}}', body: 'Hello {{name}}. {{message}} Pay {{total}} here: {{link}}' } }) }
    const mail = await renderQuoteMail('quote', { name: 'Ada', number: 'QR-1', total: '$36.00', link: 'https://x/quote/t' }, 'Here you go.', reader)
    expect(mail.subject).toBe('Quote QR-1 for Ada')
    expect(mail.text).toContain('Hello Ada. Here you go. Pay $36.00 here: https://x/quote/t')
  })
  it('keeps QUOTE_EMAILS as the same wording', () => {
    expect(QUOTE_EMAILS.quote).toEqual(EMAIL_TEMPLATE_DEFAULTS.quoteSent)
    expect(QUOTE_EMAILS.adminNew).toEqual(EMAIL_TEMPLATE_DEFAULTS.quoteAdminNew)
  })
  it('sends the same wording as before when nothing is edited, and fills the staff message', async () => {
    const values = { name: 'Ada', number: 'QR-1', total: '$36.00', validUntil: '8 March', link: 'https://x/quote/t', siteName: 'Shop' }
    const reader = { findGlobal: async (): Promise<null> => null }
    const mail = await renderQuoteMail('quote', values, 'Hi {{name}}, your total is {{total}}.', reader)
    const before = renderQuoteEmail('quote', values, 'Hi {{name}}, your total is {{total}}.')
    expect(mail.subject).toBe(before.subject)
    expect(mail.text).toContain('Hi Ada, your total is $36.00.')
    expect(mail.text).toContain('https://x/quote/t')
  })
})
