import { formatMoney } from '@/features/ecommerce/lib/money'
import { offlineMethodsFor, OFFLINE_LABELS } from '@/features/ecommerce/lib/paymentMethods'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { loadPaymentSettings, resolveStripeSecret } from '@/features/ecommerce/payments/config'
import { getStripeClient } from '@/features/ecommerce/payments/stripeAdapter'
import { sendAdminNewOrderEmail, sendOrderEmail } from '@/features/ecommerce/server/emails'
import { sendEmail } from '@/features/email'
import { renderQuoteEmail, totalCents, type QuoteEmailKey } from './logic'
import * as store from './store'

type Engine = {
  create: (a: Record<string, unknown>) => Promise<Record<string, unknown>>
  update: (a: Record<string, unknown>) => Promise<unknown>
  findByID: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  findGlobal: (a: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export async function getEngineSafe(): Promise<Engine> {
  const { getEngine } = await import('@/lib/engine')
  return (await getEngine()) as never as Engine
}

export async function siteName(engine: Engine): Promise<string> {
  const site = await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): Record<string, unknown> => ({}))
  return typeof site?.siteName === 'string' && site.siteName ? site.siteName : 'Our team'
}

export const dateText = (iso: string | null): string => (iso ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'long' }).format(new Date(iso)) : '')

export const kindLabelOf = (r: store.QuoteRequest): string => (r.kind === 'bid' ? 'offer' : r.kind === 'item' ? 'item request' : 'quote request')

/** Fills a quote email's tags from the request. Never throws: a mail failure must not undo a saved request. */
export async function sendQuoteEmail(engine: Engine, key: QuoteEmailKey, request: store.QuoteRequest, extra: { to: 'customer' | 'admin'; origin?: string; token?: string; message?: string; orderNumber?: string }): Promise<void> {
  try {
    let to = request.email
    if (extra.to === 'admin') {
      const shop = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true }).catch((): null => null)) as { emails?: { adminEmail?: unknown } } | null
      to = typeof shop?.emails?.adminEmail === 'string' ? shop.emails.adminEmail : ''
      if (!to) return
    }
    const total = request.totalCents ?? totalCents(request.lines)
    const mail = renderQuoteEmail(
      key,
      {
        name: request.name,
        email: request.email,
        number: request.number,
        kindLabel: kindLabelOf(request),
        details: request.details || (request.offerCents ? `Offer: ${formatMoney(request.offerCents, request.currency)}` : ''),
        total: formatMoney(total, request.currency),
        validUntil: dateText(request.validUntil),
        link: extra.origin && extra.token ? `${extra.origin}/quote/${extra.token}` : '',
        note: request.counterCents ? `${request.counterNote}\n\nWould pay: ${formatMoney(request.counterCents, request.currency)}`.trim() : request.counterNote,
        orderNumber: extra.orderNumber ?? '',
        siteName: await siteName(engine),
      },
      extra.message,
    )
    await sendEmail({ to, template: `quote.${key}`, ...mail })
  } catch {
    // Notification only.
  }
}

export type AcceptResult = { ok: true; orderId: number; payUrl?: string } | { ok: false; status: number; error: string }

/** Pay by card: the quote page link the customer returns to, and the site origin Stripe sends them back to. */
export type CardPayment = { origin: string; token: string }

/**
 * The customer accepts an open quote. The move to accepted is atomic, so a double click makes one order. The order is
 * Pending payment by an offline method the shop has switched on; staff mark it paid with the usual order action.
 */
export async function acceptQuote(d1: store.D1, engine: Engine, request: store.QuoteRequest, now: Date, card?: CardPayment): Promise<AcceptResult> {
  if (request.status !== 'quoted') return { ok: false, status: 409, error: request.status === 'accepted' ? 'This quote was already accepted.' : 'This quote can no longer be accepted.' }
  if (!request.validUntil || Date.parse(request.validUntil) <= now.getTime()) return { ok: false, status: 409, error: 'This quote has expired. Ask us for a new one.' }
  const settings = await loadPaymentSettings(engine as never)
  const method = offlineMethodsFor(settings.offline)[0]
  const stripeKey = card ? resolveStripeSecret(settings) : null
  if (card && !stripeKey) return { ok: false, status: 409, error: 'Card payment is not set up yet. Please contact us and we will finish this with you.' }
  if (!card && !method) return { ok: false, status: 409, error: 'Payment is not set up yet. Please contact us and we will finish this with you.' }
  const iso = now.toISOString()
  if (!(await store.moveStatus(d1, request.id, 'accepted', ['quoted'], iso))) return { ok: false, status: 409, error: 'This quote was already answered.' }
  try {
    const total = totalCents(request.lines)
    const currency = request.currency || (await loadShopCurrency(engine as never))
    const order = await engine.create({
      collection: 'orders',
      data: {
        items: [],
        lineItems: request.lines.map((l) => ({ productId: null as number | null, name: l.description, quantity: l.quantity, unitCents: l.unitCents, lineCents: l.quantity * l.unitCents, discountCents: 0, taxCents: 0 })),
        customerEmail: request.email,
        status: 'pending',
        paymentMethod: card ? 'stripe' : method!.id,
        amount: total,
        subtotal: total,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        currency: currency.toUpperCase(),
        customerNote: `Quote ${request.number}`,
      },
      overrideAccess: true,
    })
    const orderId = Number(order.id)
    await store.setOrder(d1, request.id, orderId, iso)
    if (card && stripeKey) {
      // The card is paid on Stripe's page; the payment_intent.succeeded webhook marks the order paid through its orderID metadata.
      const stripe = getStripeClient(stripeKey)
      const back = `${card.origin}/quote/${card.token}`
      let session
      try {
        session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: request.email,
          line_items: request.lines.map((l) => ({ quantity: l.quantity, price_data: { currency: currency.toLowerCase(), unit_amount: l.unitCents, product_data: { name: l.description.slice(0, 250) || `Quote ${request.number}` } } })),
          payment_intent_data: { metadata: { orderID: String(orderId) } },
          metadata: { orderID: String(orderId), quote: request.number },
          success_url: `${back}?paid=1`,
          cancel_url: back,
        })
      } catch {
        await engine.update({ collection: 'orders', id: orderId, data: { status: 'cancelled' }, overrideAccess: true }).catch((): null => null)
        throw new Error('stripe-session')
      }
      await store.addActivity(d1, request.id, 'customer', `Accepted. Order ${orderId} created, paying by card.`, iso)
      await sendQuoteEmail(engine, 'accepted', { ...request, totalCents: total }, { to: 'admin', orderNumber: String(orderId) })
      return { ok: true, orderId, payUrl: session.url ?? back }
    }
    const offline = method!
    await store.addActivity(d1, request.id, 'customer', `Accepted. Order ${orderId} created, waiting for payment by ${OFFLINE_LABELS[offline.id].toLowerCase()}.`, iso)
    try {
      const fresh = (await engine.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })) ?? order
      await sendOrderEmail(engine as never, fresh, 'awaitingPayment', undefined, { paymentMethod: OFFLINE_LABELS[offline.id], paymentInstructions: offline.instructions })
      await sendAdminNewOrderEmail(engine as never, fresh)
    } catch {
      // The order exists; the emails are a courtesy.
    }
    await sendQuoteEmail(engine, 'accepted', { ...request, totalCents: total }, { to: 'admin', orderNumber: String(orderId) })
    return { ok: true, orderId }
  } catch {
    // Put the quote back so the customer can try again.
    await store.moveStatus(d1, request.id, 'quoted', ['accepted'], iso)
    return { ok: false, status: 500, error: 'We could not place the order. Please try again.' }
  }
}
