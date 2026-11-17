import { formatMoney } from '@/features/ecommerce/lib/money'
import { loadStrings } from '@/features/uiStrings'
import { totalCents } from './logic'
import { renderQuoteMail } from './mail'
import { dateText } from './service'
import * as store from './store'

/** How far ahead of the validity date the reminder goes out. */
export const EXPIRY_LEAD_MS = 3 * 86_400_000

export type SendFn = (mail: { to: string; template: string; subject: string; text: string; html: string }) => Promise<unknown>

export const reminderMarker = (validUntil: string | null): string => `Expiry reminder sent for ${validUntil ?? ''}`

/**
 * The quote sweep, run on the 5 minute timer. First it closes quotes past their validity date, then it emails the
 * customer once for each quote that ends within 3 days. The reminder is noted in the quote's activity with the
 * validity date it was for, so a re-sent quote with a new date is reminded again and nothing is sent twice. The
 * customer's private link is only stored as a hash, so the email points back to the earlier quote email.
 * Never throws: a missing table or a failed email must not fail the cron run.
 */
export async function runQuoteSweep(d1: store.D1, now: Date, siteName: string, send: SendFn, reader?: { findGlobal: (args: never) => Promise<unknown> }): Promise<{ expired: number; reminded: number }> {
  const result = { expired: 0, reminded: 0 }
  try {
    result.expired = await store.expireOverdue(d1, now.toISOString())
    const due = await store.listExpiring(d1, now.toISOString(), new Date(now.getTime() + EXPIRY_LEAD_MS).toISOString())
    for (const request of due) {
      const marker = reminderMarker(request.validUntil)
      if (!request.email || request.activity.some((a) => a.text === marker)) continue
      try {
        await store.addActivity(d1, request.id, 'system', marker, now.toISOString())
        const { localeForRecipient } = await import('@/features/email/recipientLocale')
        const locale = reader ? await localeForRecipient(reader as never, request.email).catch((): null => null) : null
        if (locale) await loadStrings(locale)
        const mail = await renderQuoteMail('expiring', {
          name: request.name,
          number: request.number,
          total: formatMoney(request.totalCents ?? totalCents(request.lines), request.currency),
          validUntil: dateText(request.validUntil),
          siteName,
        }, undefined, reader, locale)
        await send({ to: request.email, template: 'quote.expiring', ...mail })
        result.reminded += 1
      } catch {
        // One failed email does not stop the rest.
      }
    }
  } catch {
    // Quotes not set up yet.
  }
  return result
}
