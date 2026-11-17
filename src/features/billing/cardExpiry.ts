import type Stripe from 'stripe'

import { textToHtml } from '@/features/email/renderTemplate'
import { stripeClient } from '@/features/members/billing'
import { MEMBERSHIPS_SLUG } from '@/features/members/slugs'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'

/**
 * Warns a member or shop subscriber by email before the card on their subscription expires.
 * A card works until the end of its expiry month. The warning goes out once per card expiry: the sent line
 * is kept in the membership's notes or the subscription's history, and the sweep skips what already has it.
 */

export const WARN_DAYS = 30

/** Days from `now` until the card stops working (the end of its expiry month). Negative once it has. */
export function daysUntilExpiry(expMonth: number, expYear: number, now: Date): number {
  const endOfMonth = Date.UTC(expYear, expMonth, 1) // first instant of the next month
  return Math.floor((endOfMonth - now.getTime()) / 86_400_000)
}

export const expiryLabel = (expMonth: number, expYear: number): string => `${String(expMonth).padStart(2, '0')}/${expYear}`

/** True when the card is still valid but runs out within the warning window. */
export const shouldWarn = (expMonth: number, expYear: number, now: Date, windowDays = WARN_DAYS): boolean => {
  const days = daysUntilExpiry(expMonth, expYear, now)
  return days >= 0 && days <= windowDays
}

export const sentMarker = (expMonth: number, expYear: number): string => `Card expiry warning sent for ${expiryLabel(expMonth, expYear)}`

type StripeLike = Pick<Stripe, 'subscriptions' | 'billingPortal'>

/** The card on a Stripe subscription: its own default, else the customer's default. */
export async function cardOfSubscription(stripe: StripeLike, subscriptionId: string): Promise<{ expMonth: number; expYear: number; customerId: string | null } | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['default_payment_method', 'customer.invoice_settings.default_payment_method'] })
  const customer = typeof sub.customer === 'object' && sub.customer && !('deleted' in sub.customer && sub.customer.deleted) ? (sub.customer as Stripe.Customer) : null
  const pick = (value: unknown): Stripe.PaymentMethod | null => (value && typeof value === 'object' ? (value as Stripe.PaymentMethod) : null)
  const pm = pick(sub.default_payment_method) ?? pick(customer?.invoice_settings?.default_payment_method)
  if (!pm?.card) return null
  return { expMonth: pm.card.exp_month, expYear: pm.card.exp_year, customerId: customer?.id ?? (typeof sub.customer === 'string' ? sub.customer : null) }
}

async function updateLink(stripe: StripeLike, customerId: string | null, origin: string): Promise<string> {
  if (customerId) {
    try {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/account` })
      if (session.url) return session.url
    } catch {
      // Portal not set up: the account page is the fallback.
    }
  }
  return `${origin}/account`
}

async function sendWarning(to: string, name: string, what: string, expMonth: number, expYear: number, link: string): Promise<boolean> {
  if (!to) return false
  try {
    const text = [
      `Hi ${name},`,
      '',
      `The card we have on file for ${what} expires at the end of ${expiryLabel(expMonth, expYear)}. To avoid a failed payment, please update it before then.`,
      '',
      `Update your card: ${link}`,
    ].join('\n')
    const { sendEmail } = await import('@/features/email')
    await sendEmail({ to, template: 'billing.card-expiry', subject: 'Your card is about to expire', text, html: textToHtml(text) })
    return true
  } catch {
    return false
  }
}

type Engine = {
  find: (a: Record<string, unknown>) => Promise<{ docs: unknown[] }>
  update: (a: Record<string, unknown>) => Promise<unknown>
}

export type ExpirySweep = { checked: number; warned: number }

/** Daily job body: checks active memberships and shop subscriptions that have a Stripe subscription. */
export async function sweepCardExpiry(reqEngine: unknown, now = new Date(), origin = configuredSiteOrigin(), client: StripeLike | null = stripeClient() as unknown as StripeLike | null): Promise<ExpirySweep> {
  const engine = reqEngine as Engine
  const result: ExpirySweep = { checked: 0, warned: 0 }
  if (!client) return result
  const stamp = now.toISOString()

  const memberships = await engine.find({ collection: MEMBERSHIPS_SLUG, where: { status: { equals: 'active' } }, limit: 500, depth: 1, overrideAccess: true }).catch((): { docs: unknown[] } => ({ docs: [] }))
  for (const raw of memberships.docs as { id: number; notes?: string | null; externalSubscriptionId?: string | null; user?: unknown; tier?: unknown }[]) {
    if (!raw.externalSubscriptionId) continue
    result.checked += 1
    try {
      const card = await cardOfSubscription(client, raw.externalSubscriptionId)
      if (!card || !shouldWarn(card.expMonth, card.expYear, now)) continue
      const marker = sentMarker(card.expMonth, card.expYear)
      if ((raw.notes ?? '').includes(marker)) continue
      const u = (raw.user && typeof raw.user === 'object' ? raw.user : {}) as { email?: string; name?: string }
      const tier = raw.tier && typeof raw.tier === 'object' ? ((raw.tier as { name?: string }).name ?? 'your membership') : 'your membership'
      const sent = await sendWarning(u.email?.trim() ?? '', u.name?.trim() || (u.email?.split('@')[0] ?? 'there'), tier, card.expMonth, card.expYear, await updateLink(client, card.customerId, origin))
      if (!sent) continue
      await engine.update({ collection: MEMBERSHIPS_SLUG, id: raw.id, data: { notes: [raw.notes ?? '', `${stamp.slice(0, 16).replace('T', ' ')} ${marker}.`].filter(Boolean).join('\n').slice(-4000) }, overrideAccess: true })
      result.warned += 1
    } catch (error) {
      console.error('card expiry (membership) error:', error)
    }
  }

  const subs = await engine.find({ collection: 'product-subscriptions', where: { status: { in: ['active', 'past-due'] } }, limit: 500, depth: 0, overrideAccess: true }).catch((): { docs: unknown[] } => ({ docs: [] }))
  for (const raw of subs.docs as { id: number; history?: { at: string; text: string }[] | null; stripeSubscriptionId?: string | null; customerEmail?: string | null; productName?: string | null }[]) {
    if (!raw.stripeSubscriptionId || !raw.customerEmail) continue
    result.checked += 1
    try {
      const card = await cardOfSubscription(client, raw.stripeSubscriptionId)
      if (!card || !shouldWarn(card.expMonth, card.expYear, now)) continue
      const marker = sentMarker(card.expMonth, card.expYear)
      const history = Array.isArray(raw.history) ? raw.history : []
      if (history.some((h) => h.text?.startsWith(marker))) continue
      const sent = await sendWarning(raw.customerEmail, raw.customerEmail.split('@')[0], raw.productName || 'your subscription', card.expMonth, card.expYear, await updateLink(client, card.customerId, origin))
      if (!sent) continue
      await engine.update({ collection: 'product-subscriptions', id: raw.id, data: { history: [...history, { at: stamp, text: `${marker}.` }].slice(-100) }, overrideAccess: true })
      result.warned += 1
    } catch (error) {
      console.error('card expiry (subscription) error:', error)
    }
  }
  return result
}
