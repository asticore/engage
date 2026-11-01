import { loadSmsSettings } from '../email/connectionLoad'
import { sendSms, type SmsResult } from './index'
import { isValidPhone } from './twilio'

/**
 * The shipped-order text (task 7b). One text, sent when the first shipping label of an order is bought
 * (the same moment as the shipped email). Off unless the Integrations switch
 * `communications.sms.shippedOrderText` is on, which is off by default. Never throws.
 *
 * The number is the phone on the order's shipping address. A number that is not in international
 * format is skipped, not guessed at.
 */

type Doc = Record<string, unknown>

/** The text body for a shipped order. Plain text, one line of tracking. */
export function shippedOrderTextBody(order: Doc, siteName = ''): string {
  const number = String(order.orderNumber || order.id || '')
  const carrier = typeof order.trackingCarrier === 'string' && order.trackingCarrier ? ` with ${order.trackingCarrier}` : ''
  const url = typeof order.trackingUrl === 'string' ? order.trackingUrl : ''
  const numberText = typeof order.trackingNumber === 'string' ? order.trackingNumber : ''
  const sender = siteName ? `${siteName}: ` : ''
  const trackingPart = url ? ` Track it: ${url}` : numberText ? ` Tracking number: ${numberText}` : ''
  return `${sender}Your order #${number} has shipped${carrier}.${trackingPart}`
}

/** The order's phone in international format, or null when there is none or it is not usable. */
export function shippedOrderPhone(order: Doc): string | null {
  const address = (order.shippingAddress ?? {}) as Record<string, unknown>
  const raw = typeof address.phone === 'string' ? address.phone.replace(/[\s()-]/g, '') : ''
  return isValidPhone(raw) ? raw : null
}

type Engine = Parameters<typeof loadSmsSettings>[0]

/** Sends the shipped text when the switch is on and the order has a usable phone. Returns whether a text went out. */
export async function sendShippedOrderText(engine: Engine, order: Doc): Promise<SmsResult | { ok: false; reason: 'off' | 'no-phone' }> {
  try {
    const sms = await loadSmsSettings(engine)
    if (!sms || !(sms.shippedOrderText === true || sms.shippedOrderText === 1)) return { ok: false, reason: 'off' }
    const to = shippedOrderPhone(order)
    if (!to) return { ok: false, reason: 'no-phone' }
    const site = (await (engine as unknown as { findGlobal: (a: Doc) => Promise<Doc> }).findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): Doc => ({}))) as { siteName?: string }
    return await sendSms(to, shippedOrderTextBody(order, site.siteName ?? ''))
  } catch {
    return { ok: false, reason: 'off' }
  }
}
