import { hashToken, newQuoteToken } from './logic'
import { sendQuoteEmail } from './service'
import * as store from './store'

const DAY = 86_400_000

/** Turns the winning offer into an open quote at its price and emails the accept link. Returns false when it was already handled. */
export async function saveQuoteAndSend(d1: store.D1, engine: unknown, bid: store.QuoteRequest, title: string, now: Date, origin: string): Promise<boolean> {
  const cents = bid.offerCents ?? 0
  if (cents <= 0) return false
  const token = newQuoteToken()
  const iso = now.toISOString()
  const quantity = 1
  const saved = await store.saveQuote(d1, bid.id, { lines: [{ description: title || 'Your item', quantity, unitCents: cents }], totalCents: cents * quantity, validUntil: new Date(now.getTime() + 7 * DAY).toISOString(), terms: '', tokenHash: await hashToken(token) }, iso)
  if (!saved) return false
  await store.addActivity(d1, bid.id, 'system', 'Highest offer when offers closed. Quote sent at the offered price.', iso)
  const fresh = (await store.getRequest(d1, bid.id)) ?? bid
  await sendQuoteEmail(engine as never, 'quote', fresh, { to: 'customer', origin, token, message: 'Good news: your offer was the highest when offers closed. Here is your quote at the price you offered.' })
  return true
}
