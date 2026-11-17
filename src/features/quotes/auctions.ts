import { saveQuoteAndSend } from './auctionQuote'
import { auctionWinner } from './logic'
import { sendQuoteEmail } from './service'
import * as store from './store'

/** How long the winner has to accept the quote made from their offer. */
export const WINNER_DAYS = 7

/**
 * Closes the auctions that ended: for each product whose offers closed, the highest unanswered offer becomes a quote at
 * its own price (emailed with the usual accept link) and every other offer is declined and told so. Products with no end
 * time are left for staff. Each offer moves out of "new" before anything is sent, so a repeat run never emails twice.
 * Never throws.
 */
export async function runAuctionSweep(d1: store.D1, engine: unknown, now: Date, origin: string): Promise<{ won: number; lost: number }> {
  const result = { won: 0, lost: 0 }
  try {
    for (const productId of await store.productsWithOpenBids(d1)) {
      const terms = await store.productBidTerms(d1, productId)
      if (!terms?.endsAt || Date.parse(terms.endsAt) > now.getTime()) continue
      const bids = await store.openBidsFor(d1, productId)
      const winnerId = auctionWinner(bids.map((b) => ({ id: b.id, offerCents: b.offerCents })))
      for (const bid of bids) {
        try {
          if (bid.id === winnerId) {
            if (await saveQuoteAndSend(d1, engine, bid, terms.title, now, origin)) result.won += 1
          } else if (await store.moveStatus(d1, bid.id, 'declined', ['new'], now.toISOString())) {
            await store.addActivity(d1, bid.id, 'system', 'Offers closed; another offer was higher.', now.toISOString())
            await sendQuoteEmail(engine as never, 'bidLost', bid, { to: 'customer' })
            result.lost += 1
          }
        } catch {
          // One failed email does not stop the rest.
        }
      }
    }
  } catch {
    // Quotes not set up yet.
  }
  return result
}
