import type Stripe from 'stripe'

import { fillTemplate, textToHtml } from '@/features/email/renderTemplate'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'

import { afterRetry, CLEARED, DUNNING_EMAILS, dueAction, onPaymentFailed, stateOf, type DunningEmailKind, type DunningState } from './dunning'
import { findTierBySlug } from './entitlement'
import { stripeClient } from './billing'
import { getMemberSettings } from './settings'
import { MEMBERSHIPS_SLUG } from './slugs'
import type { MembershipDoc, MembershipTierDoc } from './types'

/**
 * The effects of dunning: writing the run onto the membership, retrying the open invoice, emailing, and ending the
 * membership. The decisions are in dunning.ts. Every step is safe to repeat: a webhook redelivery or an overlapping
 * sweep sees the stored state and does nothing twice.
 */

type Engine = {
  find: (a: Record<string, unknown>) => Promise<{ docs: unknown[] }>
  findByID: (a: Record<string, unknown>) => Promise<unknown>
  update: (a: Record<string, unknown>) => Promise<unknown>
  findGlobal: (a: Record<string, unknown>) => Promise<unknown>
}

const asEngine = (e: unknown): Engine => e as Engine

const dateText = (iso: string | null | undefined): string => (iso ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'long' }).format(new Date(iso)) : '')

const dataOf = (s: DunningState): Record<string, unknown> => ({ dunningStartedAt: s.startedAt, dunningAttempts: s.attempts, dunningNextAt: s.nextAt, graceEndsAt: s.graceEndsAt })

const tierName = (m: MembershipDoc): string => (m.tier && typeof m.tier === 'object' ? ((m.tier as MembershipTierDoc).name ?? 'membership') : 'membership')
const user = (m: MembershipDoc): { email: string; name: string } => {
  const u = (m.user && typeof m.user === 'object' ? m.user : {}) as { email?: string; name?: string }
  return { email: u.email?.trim() ?? '', name: u.name?.trim() || (u.email?.split('@')[0] ?? 'there') }
}

/** Adds a line to the membership's internal notes. This is the activity log staff read. */
async function logLine(engine: Engine, m: MembershipDoc, text: string, now: Date): Promise<void> {
  const line = `${now.toISOString().slice(0, 16).replace('T', ' ')} ${text}`
  await engine.update({ collection: MEMBERSHIPS_SLUG, id: m.id, data: { notes: [m.notes ?? '', line].filter(Boolean).join('\n').slice(-4000) }, overrideAccess: true }).catch((): null => null)
}

/** A link where the member can fix their card: the Stripe billing portal when it is set up, otherwise their account page. */
async function updateCardLink(stripe: Stripe | null, customerId: string | null | undefined, origin: string): Promise<string> {
  if (stripe && customerId) {
    try {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/account` })
      if (session.url) return session.url
    } catch {
      // The portal is not set up: the account page is the fallback.
    }
  }
  return `${origin}/account`
}

async function send(engine: Engine, m: MembershipDoc, kind: DunningEmailKind, extra: { graceEnds?: string | null; freeTier?: string; link: string }): Promise<boolean> {
  const who = user(m)
  if (!who.email) return false
  try {
    const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): null => null)) as { siteName?: string } | null
    const values = { name: who.name, tier: tierName(m), graceEnds: dateText(extra.graceEnds ?? m.graceEndsAt), freeTier: extra.freeTier ?? 'the free tier', link: extra.link, siteName: site?.siteName || 'Our team' }
    const t = DUNNING_EMAILS[kind]
    const text = fillTemplate(t.body, values)
    const { sendEmail } = await import('@/features/email')
    await sendEmail({ to: who.email, template: `membership.dunning-${kind}`, subject: fillTemplate(t.subject, values).replace(/[\r\n]+/g, ' '), text, html: textToHtml(text) })
    return true
  } catch {
    return false
  }
}

/** A renewal payment failed (webhook). The first failure starts the run and emails the member; later ones only count. */
export async function startDunning(reqEngine: unknown, membership: MembershipDoc, stripeAttempt: number, now = new Date(), origin = configuredSiteOrigin()): Promise<void> {
  const engine = asEngine(reqEngine)
  const settings = await getMemberSettings(engine as never)
  const { state, started } = onPaymentFailed(stateOf(membership), now, settings.billing, stripeAttempt)
  await engine.update({ collection: MEMBERSHIPS_SLUG, id: membership.id, data: { status: 'past-due', ...dataOf(state) }, overrideAccess: true })
  if (!started) return
  await logLine(engine, membership, `Payment failed. Access kept until ${dateText(state.graceEndsAt)}; retries on days ${settings.billing.dunningRetryDays.join(', ') || 'none'}.`, now)
  const link = await updateCardLink(stripeClient(), membership.externalCustomerId, origin)
  await send(engine, membership, 'failed', { graceEnds: state.graceEndsAt, link })
}

/** The invoice was paid (webhook): the run is over. Emails the member once if a run was going. */
export async function clearDunning(reqEngine: unknown, membership: MembershipDoc, now = new Date(), origin = configuredSiteOrigin()): Promise<void> {
  if (!membership.dunningStartedAt && !membership.graceEndsAt) return
  const engine = asEngine(reqEngine)
  await engine.update({ collection: MEMBERSHIPS_SLUG, id: membership.id, data: dataOf(CLEARED), overrideAccess: true })
  await logLine(engine, membership, 'Payment received. Dunning cleared.', now)
  await send(engine, membership, 'recovered', { link: `${origin}/account` })
}

/** Tries the open invoice again with the card on file. Returns true when the card cleared (the webhook then ends the run). */
export async function retryInvoice(stripe: Stripe, subscriptionId: string): Promise<boolean> {
  try {
    const open = await stripe.invoices.list({ subscription: subscriptionId, status: 'open', limit: 1 })
    const invoice = open.data[0]
    if (!invoice?.id) return false
    const paid = await stripe.invoices.pay(invoice.id)
    return paid.status === 'paid'
  } catch {
    return false
  }
}

/** The grace period is over: end the membership, or move it to the free tier when settings say so and one exists. */
export async function endRun(reqEngine: unknown, membership: MembershipDoc, stripe: Stripe | null, now = new Date(), origin = configuredSiteOrigin()): Promise<'expired' | 'free-tier'> {
  const engine = asEngine(reqEngine)
  const settings = await getMemberSettings(engine as never)
  const subscriptionId = membership.externalSubscriptionId ?? null
  const free = settings.billing.dunningEndAction === 'free-tier' && settings.registration.defaultTier ? await findTierBySlug(engine as never, settings.registration.defaultTier) : null
  // The subscription id is dropped first, so the "subscription deleted" webhook from the cancel below finds no membership and leaves our result alone.
  const link = await updateCardLink(null, null, origin)
  if (free) {
    await engine.update({ collection: MEMBERSHIPS_SLUG, id: membership.id, data: { tier: free.id, status: 'active', externalSubscriptionId: null, renewsAt: null, cancelAtPeriodEnd: false, ...dataOf(CLEARED) }, overrideAccess: true })
  } else {
    await engine.update({ collection: MEMBERSHIPS_SLUG, id: membership.id, data: { status: 'expired', externalSubscriptionId: null, ...dataOf(CLEARED) }, overrideAccess: true })
  }
  if (stripe && subscriptionId) await stripe.subscriptions.cancel(subscriptionId).catch((): null => null)
  await logLine(engine, membership, free ? `Grace period over, payment still unpaid. Moved to ${free.name}.` : 'Grace period over, payment still unpaid. Membership ended.', now)
  await send(engine, membership, free ? 'downgraded' : 'ended', { freeTier: free?.name, link })
  return free ? 'free-tier' : 'expired'
}

export type SweepResult = { checked: number; retried: number; ended: number }

/** The hourly job: retry and remind what is due, end what has run out. Never throws on one membership. */
export async function sweepDunning(reqEngine: unknown, now = new Date(), origin = configuredSiteOrigin()): Promise<SweepResult> {
  const engine = asEngine(reqEngine)
  const result: SweepResult = { checked: 0, retried: 0, ended: 0 }
  const settings = await getMemberSettings(engine as never)
  if (!settings.featureEnabled) return result
  const stripe = stripeClient()
  const { docs } = await engine.find({ collection: MEMBERSHIPS_SLUG, where: { status: { equals: 'past-due' } }, limit: 500, depth: 1, overrideAccess: true }).catch((): { docs: unknown[] } => ({ docs: [] }))
  for (const raw of docs as MembershipDoc[]) {
    result.checked += 1
    try {
      const state = stateOf(raw)
      const action = dueAction(state, now)
      if (action === 'end') {
        await endRun(engine, raw, stripe, now, origin)
        result.ended += 1
      } else if (action === 'retry') {
        const paid = stripe && raw.externalSubscriptionId ? await retryInvoice(stripe, raw.externalSubscriptionId) : false
        const next = afterRetry(state, settings.billing)
        await engine.update({ collection: MEMBERSHIPS_SLUG, id: raw.id, data: dataOf(next), overrideAccess: true })
        await logLine(engine, raw, paid ? 'Retried the card: paid.' : `Retried the card: not paid (attempt ${next.attempts}).`, now)
        if (!paid) await send(engine, raw, 'retry', { graceEnds: state.graceEndsAt, link: await updateCardLink(stripe, raw.externalCustomerId, origin) })
        result.retried += 1
      }
    } catch (error) {
      console.error('member dunning error:', error)
    }
  }
  return result
}
