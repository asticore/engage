/**
 * Offline payment methods (bank transfer, cheque, cash on delivery). The order is priced on the server like every
 * other checkout, saved as Pending payment with the chosen method, and the customer is sent the shop's instructions.
 * Nothing is taken from a card: staff mark the order paid when the money arrives, which runs the same
 * markOrderPaid path as a card payment (stock, invoice number, cart, emails, webhook).
 */
import { CheckoutError } from '../server/pricing'
import { rawD1, runChanges, SQL } from '../server/db'
import { markOrderPaid, addOrderNote } from '../server/orders'
import { sendAdminNewOrderEmail, sendOrderEmail } from '../server/emails'
import { isOfflineMethod, offlineEnabled, offlineMethodsFor, OFFLINE_LABELS, type OfflineMethod } from '../lib/paymentMethods'
import { loadPaymentSettings, resolveStripeSecret } from './config'
import { buildOrderDraft, getStripeClient, payInFullWithStoredValue, type InitiateStripePaymentArgs } from './stripeAdapter'

type Db = {
  find: (a: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }>
  findByID: (a: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  create: (a: Record<string, unknown>) => Promise<Record<string, unknown>>
  update: (a: Record<string, unknown>) => Promise<Record<string, unknown>>
}

export type OfflineCheckoutResult = { orderID: number; paidInFull?: boolean; message: string }

/** Places an order to be paid offline. Throws CheckoutError with a shopper-facing message when it cannot. */
export async function createOfflineCheckout(args: InitiateStripePaymentArgs & { method: unknown }): Promise<OfflineCheckoutResult> {
  const db = args.engine as unknown as Db
  const { cart, user, billingAddress } = args
  const settings = await loadPaymentSettings(args.engine as never)
  if (!offlineEnabled(settings.offline, args.method)) throw new CheckoutError('That payment method is not available right now.')
  const method: OfflineMethod = args.method
  const draft = await buildOrderDraft(args)
  const { orderData, amount, currency, email } = draft
  if (amount === 0) {
    // Gift cards and store credit cover it: nothing is left to pay offline.
    const paid = await payInFullWithStoredValue(args.engine as never, cart.id, { ...orderData, paymentMethod: method }, email)
    return { orderID: paid.orderID ?? 0, paidInFull: true, message: paid.message }
  }

  // A pending order already on this cart is reused (a card intent on it is cancelled first, so it cannot be paid as well).
  const existing = await db
    .find({ collection: 'orders', where: { cartId: { equals: cart.id }, status: { equals: 'pending' } }, limit: 1, depth: 0, overrideAccess: true })
    .then((r) => r.docs[0] as { id: number; paymentIntentId?: string | null } | undefined)
    .catch((): undefined => undefined)

  let orderId: number
  const data: Record<string, unknown> = { ...orderData, paymentMethod: method, paymentIntentId: null, paypalOrderId: null, paypalCaptureId: null }
  if (existing) {
    if (existing.paymentIntentId) {
      const secret = resolveStripeSecret(settings)
      if (secret) await getStripeClient(secret).paymentIntents.cancel(existing.paymentIntentId).catch((): null => null)
    }
    orderId = existing.id
    await db.update({ collection: 'orders', id: orderId, data, overrideAccess: true })
  } else {
    const order = await db.create({ collection: 'orders', data, overrideAccess: true })
    orderId = Number(order.id)
  }

  // One pending transaction per order and method, so staff can see what the customer chose.
  const txn = await db.find({ collection: 'transactions', where: { order: { equals: orderId }, paymentMethod: { equals: method } }, limit: 1, depth: 0, overrideAccess: true })
  if (txn.docs.length === 0) {
    await db.create({
      collection: 'transactions',
      data: {
        ...(user ? { customer: user.id } : { customerEmail: email }),
        amount,
        billingAddress: billingAddress ?? null,
        cart: cart.id,
        currency: currency.toUpperCase(),
        items: orderData.items,
        order: orderId,
        paymentMethod: method,
        status: 'pending',
      },
      overrideAccess: true,
    })
  }

  // The cart is spent once the order is placed, so abandoned-cart reminders do not chase a customer who has already ordered.
  const d1 = await rawD1()
  await runChanges(d1, SQL.cartPurchased, cart.id, new Date().toISOString())
  await db.update({ collection: 'carts', id: cart.id, data: { email }, overrideAccess: true }).catch((): null => null)

  const order = (await db.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })) ?? { id: orderId, ...data }
  const details = offlineMethodsFor(settings.offline).find((m) => m.id === method)?.instructions ?? ''
  await sendOrderEmail(args.engine as never, order, 'awaitingPayment', undefined, { paymentMethod: OFFLINE_LABELS[method], paymentInstructions: details })
  await sendAdminNewOrderEmail(args.engine as never, order)
  return { orderID: orderId, message: `Order placed. Pay by ${OFFLINE_LABELS[method].toLowerCase()} to complete it.` }
}

/**
 * Staff have received the money for an offline order: marks it paid through markOrderPaid. Refuses an order that is
 * not waiting for an offline payment (already paid, cancelled, or paid by card).
 */
export async function markOfflineOrderPaid(engine: unknown, orderId: number, by: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = engine as Db
  const order = await db.findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
  if (!order) return { ok: false, error: 'Order not found.' }
  const method = order.paymentMethod
  if (!isOfflineMethod(method)) return { ok: false, error: 'This order was not paid by an offline method.' }
  if (order.status !== 'pending' && order.status !== 'failed') return { ok: false, error: 'This order is not waiting for payment.' }
  const txn = await db.find({ collection: 'transactions', where: { order: { equals: orderId }, paymentMethod: { equals: method } }, limit: 1, depth: 0, overrideAccess: true })
  const transactionId = txn.docs[0]?.id as number | undefined
  const result = await markOrderPaid(engine as never, orderId, { transactionId })
  if (!result.firstTime) return { ok: false, error: 'This order was already marked paid.' }
  await addOrderNote(engine as never, orderId, { type: 'internal', text: `Payment received by ${OFFLINE_LABELS[method]} and marked paid by ${by}.`, author: by })
  return { ok: true }
}
