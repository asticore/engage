import { sendEmail } from '@/features/email'
import { localeForRecipient } from '@/features/email/recipientLocale'
import { toRenderTokens } from '@/features/email/builtInTemplates'
import { fallbackChain, loadStrings, t as uiT, type UiStringKey } from '@/features/uiStrings'
import { escapeHtml } from '../lib/invoice'
import { formatCents } from '../lib/money'
import { ORDER_STATUS_LABELS, isOrderStatus } from '../lib/orderStatus'
import { preorderSummary } from '../lib/preorder'

type Engine = {
  findGlobal: (a: unknown) => Promise<Record<string, unknown>>
  find?: (a: unknown) => Promise<{ docs: Array<Record<string, unknown>> }>
}
export type EmailKind = 'processing' | 'completed' | 'onHold' | 'cancelled' | 'refunded' | 'failed' | 'customerNote' | 'shipped' | 'reviewRequest' | 'awaitingPayment'

const STATUS_TO_KIND: Record<string, EmailKind | undefined> = {
  processing: 'processing',
  completed: 'completed',
  'on-hold': 'onHold',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'failed',
}
/** Links to the reviews of each product in the order, on the shop's product pages. Needs SITE_URL to be absolute. */
export function reviewLinksFor(order: Record<string, unknown>, slugById: Map<number, { slug: string; title: string }>): string {
  const base = (process.env.SITE_URL ?? '').replace(/\/+$/, '')
  const items = (Array.isArray(order.lineItems) ? order.lineItems : []) as Array<{ productId?: unknown }>
  const seen = new Set<number>()
  const lines: string[] = []
  for (const item of items) {
    const id = Number(item.productId)
    const product = slugById.get(id)
    if (!product || seen.has(id)) continue
    seen.add(id)
    lines.push(base ? `${product.title}: ${base}/shop/${product.slug}#reviews` : product.title)
  }
  return lines.join('\n')
}

/** The product slugs and titles behind an order's lines, read once for the review request. */
async function productsForReview(engine: Engine, order: Record<string, unknown>): Promise<Map<number, { slug: string; title: string }>> {
  const items = (Array.isArray(order.lineItems) ? order.lineItems : []) as Array<{ productId?: unknown }>
  const ids = [...new Set(items.map((i) => Number(i.productId)).filter((n) => Number.isInteger(n) && n > 0))]
  const out = new Map<number, { slug: string; title: string }>()
  if (ids.length === 0 || !engine.find) return out
  const { docs } = await engine.find({ collection: 'products', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true })
  for (const doc of docs) {
    if (typeof doc.id === 'number' && typeof doc.slug === 'string' && doc.slug) out.set(doc.id, { slug: doc.slug, title: String(doc.title ?? doc.slug) })
  }
  return out
}

export const kindForStatus = (status: string): EmailKind | null => STATUS_TO_KIND[status] ?? null

const DEFAULTS: Record<EmailKind, { subject: string; body: string }> = {
  processing: { subject: 'Thanks - we received order #{{order_id}}', body: 'Hi {{customer_name}},\n\nThanks for your order. We are getting it ready. Order total: {{order_total}}.' },
  completed: { subject: 'Your order #{{order_id}} is complete', body: 'Hi {{customer_name}},\n\nYour order #{{order_id}} is complete.' },
  onHold: { subject: 'Your order #{{order_id}} is on hold', body: 'Hi {{customer_name}},\n\nYour order #{{order_id}} is on hold. We will be in touch.' },
  cancelled: { subject: 'Your order #{{order_id}} was cancelled', body: 'Hi {{customer_name}},\n\nYour order #{{order_id}} has been cancelled.' },
  refunded: { subject: 'Your order #{{order_id}} was refunded', body: 'Hi {{customer_name}},\n\nA refund has been issued for order #{{order_id}}. {{note}}' },
  failed: { subject: 'Payment failed for order #{{order_id}}', body: 'Hi {{customer_name}},\n\nThe payment for order #{{order_id}} did not go through.' },
  customerNote: { subject: 'A note about your order #{{order_id}}', body: 'Hi {{customer_name}},\n\nThere is a note on your order #{{order_id}}:\n\n{{note}}' },
  shipped: { subject: 'Your order #{{order_id}} is on its way', body: 'Hi {{customer_name}},\n\nYour order #{{order_id}} has shipped with {{carrier}}.\nTracking number: {{tracking_number}}\nTrack it here: {{tracking_url}}' },
  reviewRequest: { subject: 'How was your order #{{order_id}}?', body: 'Hi {{customer_name}},\n\nThanks for your order #{{order_id}}. If you have a moment, please tell other shoppers what you think:\n\n{{review_links}}' },
  awaitingPayment: { subject: 'Your order #{{order_id}} is waiting for payment', body: 'Hi {{customer_name}},\n\nThanks for your order #{{order_id}}. Total: {{order_total}}.\n\nPay by {{payment_method}}:\n{{payment_instructions}}\n\nWe will start on your order when the payment arrives.' },
}

/** Every kind a shop owner can edit the wording of (Shop settings > Emails). */
export const EMAIL_KINDS: EmailKind[] = ['processing', 'completed', 'onHold', 'cancelled', 'refunded', 'failed', 'shipped', 'customerNote']
export const DEFAULT_EMAIL_TEMPLATES = DEFAULTS

/** Replaces {{field}} with already-escaped values; unknown fields become empty. */
export function mergeFields(template: string, values: Record<string, string>, escape: boolean): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => {
    const v = values[key] ?? ''
    return escape ? escapeHtml(v) : v
  })
}

export type EmailTemplateOverride = { subject?: string; body?: string }

/** Reads `<kind>Subject` / `<kind>Body` from the `templates` group of the shop settings. Blank means "use the built-in text". */
export function templateFor(templates: unknown, kind: EmailKind): EmailTemplateOverride {
  const t = (templates && typeof templates === 'object' ? templates : {}) as Record<string, unknown>
  const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  return { subject: clean(t[`${kind}Subject`], 300), body: clean(t[`${kind}Body`], 5000) }
}

/**
 * The built-in wording for one order email in the reader's language. English, or
 * no locale, returns the original text. Keys are `email.order.<kind>.subject|body`.
 * Translations are read from the dictionary `sendOrderEmail` has already loaded.
 */
const orderTemplateFor = (kind: EmailKind, locale: string | null | undefined): { subject: string; body: string } => {
  const [primary] = fallbackChain(locale)
  if (!locale || primary === 'en') return DEFAULTS[kind]
  return {
    subject: toRenderTokens(uiT(`email.order.${kind}.subject` as UiStringKey, locale)),
    body: toRenderTokens(uiT(`email.order.${kind}.body` as UiStringKey, locale)),
  }
}

export function renderOrderEmail(kind: EmailKind, order: Record<string, unknown>, opts: { note?: string; siteName?: string; bodyOverride?: string; template?: EmailTemplateOverride; locale?: string | null; paymentInstructions?: string; paymentMethod?: string; reviewLinks?: string }) {
  const addr = (order.shippingAddress ?? {}) as Record<string, unknown>
  const name = [addr.firstName, addr.lastName].filter((x) => typeof x === 'string' && x).join(' ') || 'there'
  const status = String(order.status ?? '')
  const values: Record<string, string> = {
    order_id: String(order.id ?? ''),
    customer_name: name,
    order_total: formatCents(order.amount as number, (order.currency as string) || 'AUD'),
    status: isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status,
    note: opts.note ?? '',
    site_name: opts.siteName ?? '',
    order_number: String(order.orderNumber || order.id || ''),
    carrier: String(order.trackingCarrier ?? ''),
    tracking_number: String(order.trackingNumber ?? ''),
    tracking_url: String(order.trackingUrl ?? ''),
    payment_method: opts.paymentMethod ?? '',
    payment_instructions: opts.paymentInstructions ?? '',
    review_links: opts.reviewLinks ?? '',
  }
  const tpl = orderTemplateFor(kind, opts.locale)
  const subject = mergeFields(opts.template?.subject ?? tpl.subject, values, false).replace(/[\r\n]+/g, ' ')
  // A per-status template wins over the shared body, which wins over the built-in text.
  const bodyTpl = opts.template?.body ?? (opts.bodyOverride && kind !== 'customerNote' ? opts.bodyOverride : tpl.body)
  // Pre-order lines get one extra paragraph, whatever the wording of the template.
  const preorderNote = preorderSummary(order.lineItems)
  const text = mergeFields(bodyTpl, values, false) + (preorderNote ? `\n\n${preorderNote}` : '')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${mergeFields(bodyTpl, values, true).replace(/\n/g, '<br>')}${preorderNote ? `<p>${escapeHtml(preorderNote)}</p>` : ''}</div>`
  return { subject, text, html }
}

/** Sends one order email if its toggle is on. Never throws. */
/** Trims a wording field from the settings; blank means the built-in text. */
const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function sendOrderEmail(engine: Engine, order: Record<string, unknown>, kind: EmailKind, note?: string, extra: { paymentInstructions?: string; paymentMethod?: string } = {}): Promise<boolean> {
  try {
    const to = typeof order.customerEmail === 'string' ? order.customerEmail : ''
    if (!to) return false
    const settings = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true })) as { emails?: Record<string, unknown>; templates?: unknown }
    const emails = settings.emails ?? {}
    let template = templateFor(settings.templates, kind)
    // The shared body template is for the status emails only. Offline instructions and review requests keep their own wording.
    let bodyOverride = typeof emails.bodyTemplate === 'string' && emails.bodyTemplate.trim() ? emails.bodyTemplate : undefined
    if (kind === 'reviewRequest') {
      // Review requests are switched and worded on the Shop switches global (the shop-settings row is full). Off by default.
      const switches = ((await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null)) ?? {}) as Record<string, unknown>
      if (switches.reviewRequestEmail !== true) return false
      template = { subject: clean(switches.reviewRequestSubject, 300) || undefined, body: clean(switches.reviewRequestBody, 5000) || undefined }
      bodyOverride = undefined
    } else {
      if (kind === 'awaitingPayment') bodyOverride = undefined
      if ((emails[kind] ?? (kind !== 'failed')) === false || emails[kind] === 0) return false
    }
    const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => ({}))) as { siteName?: string }
    // The customer's own language, when they have chosen one. Otherwise English.
    const locale = await localeForRecipient(engine as never, to)
    if (locale) await loadStrings(locale)
    const msg = renderOrderEmail(kind, order, { note, siteName: site.siteName, locale, template, bodyOverride, ...extra, reviewLinks: kind === 'reviewRequest' ? reviewLinksFor(order, await productsForReview(engine, order)) : undefined })
    const result = await sendEmail({ to, template: `order.${kind}`, ...msg })
    return result.ok
  } catch {
    return false
  }
}

export async function sendAdminNewOrderEmail(engine: Engine, order: Record<string, unknown>): Promise<void> {
  try {
    const settings = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true })) as { emails?: Record<string, unknown> }
    const emails = settings.emails ?? {}
    const to = typeof emails.adminEmail === 'string' ? emails.adminEmail : ''
    if (!to || !emails.newOrderAdmin) return
    await sendEmail({ to, template: 'order.admin-new', subject: `New order #${order.id}`, text: `New order #${order.id}, total ${formatCents(order.amount as number)}.` })
  } catch {
    /* notification only */
  }
}

/** Tells the shop admin an order needs a person's attention (late payment, oversold, mismatch). Never throws. */
export async function sendAdminAttentionEmail(engine: Engine, orderId: number, text: string): Promise<void> {
  try {
    const settings = (await engine.findGlobal({ slug: 'shop-settings', depth: 0, overrideAccess: true })) as { emails?: Record<string, unknown> }
    const to = typeof settings.emails?.adminEmail === 'string' ? settings.emails.adminEmail : ''
    if (!to) return
    await sendEmail({ to, template: 'order.admin-attention', subject: `Order #${orderId} needs attention`, text: `Order #${orderId} needs attention: ${text}` })
  } catch {
    /* notification only */
  }
}
