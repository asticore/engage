import { fillTemplate, type RenderedEmail, type TemplateValues } from '@/features/email/renderTemplate'

import { QUOTE_TEMPLATE_KEYS, renderQuoteEmail, type QuoteEmailKey } from './logic'

/**
 * A quote email, in the wording the site set in Email templates (and the layout from the email designer), or the built-in
 * wording when nothing is set. `locale` is the customer's own language (built-in wording only; wording the site typed wins). `message` is what staff typed when sending a quote; it fills {{message}}. Never throws: any
 * failure reading the templates falls back to the built-in wording. Pass `reader` (anything with findGlobal) when the caller has the engine.
 */
export async function renderQuoteMail(key: QuoteEmailKey, values: TemplateValues, message?: string, reader?: { findGlobal: (args: never) => Promise<unknown> }, locale?: string | null): Promise<RenderedEmail> {
  const withMessage = { ...values, message: fillTemplate(message || 'Thanks for asking. Here is your quote.', values) }
  try {
    const { renderEmailTemplate } = await import('@/features/email/templateLoad')
    const mail = await renderEmailTemplate(QUOTE_TEMPLATE_KEYS[key], withMessage, reader, locale)
    return { ...mail, subject: mail.subject.replace(/[\r\n]+/g, ' ') }
  } catch {
    return renderQuoteEmail(key, values, message)
  }
}
