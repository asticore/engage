import type { Engine } from '@/engine'
import type { PortalTexts } from '@/features/multilingual/portalStrings'

import { bookingsForCustomer } from './bookings'
import type { AccountUser } from './session'
import { matchesTerms, orderNumberIn, PORTAL_SEARCH_MAX_RESULTS, searchTerms, type AccountSearchResults } from './portalSearch'
import { ORDERS_SLUG } from './types'

/** The shop's subscription rows, the same collection the subscriptions screen reads. */
const SUBSCRIPTIONS_SLUG = 'product-subscriptions'

/**
 * The signed-in customer's own orders (by number), bookings and subscriptions
 * that match a query. Identity comes from the session user only, never from the query.
 *
 * Orders run with `overrideAccess: false`, so the shop's owner rule decides which
 * orders can match at all. Bookings reuse `bookingsForCustomer`, which already
 * applies the verified-address rule. Subscriptions are read the way the
 * subscriptions screen reads them: the query's `customer` equals the session user.
 */
export async function searchAccount(engine: Engine, user: AccountUser, query: string, tx: PortalTexts): Promise<AccountSearchResults> {
  const terms = searchTerms(query)

  const number = orderNumberIn(query)
  const orderDocs =
    number === null
      ? []
      : ((await engine
          .find({
            collection: ORDERS_SLUG,
            where: { id: { equals: number } },
            limit: 1,
            depth: 0,
            overrideAccess: false,
            user,
          })
          .catch((): { docs: Array<{ id: number }> } => ({ docs: [] }))).docs)
  const orders = orderDocs.slice(0, PORTAL_SEARCH_MAX_RESULTS).map((order) => ({
    id: order.id,
    label: tx('orders.numberLink', { id: order.id }),
    href: `/account/orders/${order.id}`,
  }))

  const bookings = (await bookingsForCustomer(engine, user))
    .filter((booking) => matchesTerms([booking.eventTitle], terms))
    .slice(0, PORTAL_SEARCH_MAX_RESULTS)
    .map((booking) => ({ id: booking.id, label: booking.eventTitle, href: '/account/bookings' }))

  const { docs: subscriptionDocs } = (await (engine as unknown as {
    find: (args: unknown) => Promise<{ docs: Array<{ id: number; productName?: string | null }> }>
  })
    .find({
      collection: SUBSCRIPTIONS_SLUG,
      where: { customer: { equals: Number(user.id) } },
      sort: '-createdAt',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    .catch((): { docs: Array<{ id: number; productName?: string | null }> } => ({ docs: [] }))) as { docs: Array<{ id: number; productName?: string | null }> }
  const subscriptions = subscriptionDocs
    .filter((row) => matchesTerms([row.productName], terms))
    .slice(0, PORTAL_SEARCH_MAX_RESULTS)
    .map((row) => ({
      id: row.id,
      label: row.productName || tx('subscriptions.fallbackProduct'),
      href: '/account/subscriptions',
    }))

  return { orders, bookings, subscriptions }
}
