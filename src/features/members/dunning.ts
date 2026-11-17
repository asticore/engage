/**
 * Dunning: chasing a failed membership payment. Pure, so the whole path can be tested by moving a clock.
 *
 * A failed renewal starts a run. The member keeps access for a grace period while the card is retried and they are
 * emailed on a schedule (days after the first failure). When the grace period ends with the invoice still unpaid the
 * membership ends, or moves to the free tier. A paid invoice clears the run. Stripe's own smart retries still run;
 * this is the local state machine on top, so the chasing and the emails do not depend on Stripe's settings.
 */
import type { MembershipDoc, MemberSettings } from './types'

const DAY = 86_400_000

/** "1, 3, 5,7" to [1, 3, 5, 7]: whole days from 1 to 60, ascending, no repeats. Anything else is dropped. */
export function parseRetryDays(text: string): number[] {
  const days = new Set<number>()
  for (const part of text.split(/[,\s]+/)) {
    const n = Math.floor(Number(part))
    if (part && Number.isFinite(n) && n >= 1 && n <= 60) days.add(n)
  }
  return [...days].sort((a, b) => a - b)
}

export type DunningState = { startedAt: string | null; attempts: number; nextAt: string | null; graceEndsAt: string | null }
export type DunningSettings = Pick<MemberSettings['billing'], 'dunningRetryDays' | 'dunningGraceDays' | 'dunningEndAction'>

export const stateOf = (m: Pick<MembershipDoc, 'dunningStartedAt' | 'dunningAttempts' | 'dunningNextAt' | 'graceEndsAt'>): DunningState => ({
  startedAt: m.dunningStartedAt ?? null,
  attempts: Math.max(0, Math.floor(Number(m.dunningAttempts ?? 0))),
  nextAt: m.dunningNextAt ?? null,
  graceEndsAt: m.graceEndsAt ?? null,
})

export const CLEARED: DunningState = { startedAt: null, attempts: 0, nextAt: null, graceEndsAt: null }

const iso = (ms: number): string => new Date(ms).toISOString()

/** When retry number `n` (0 = the first) is due, from the day the run started, or null when the schedule is used up. */
function retryAt(startedAt: string, n: number, s: DunningSettings): string | null {
  const day = s.dunningRetryDays[n]
  if (day === undefined) return null
  return iso(Date.parse(startedAt) + day * DAY)
}

/**
 * A failed payment was seen. The first one starts the run (and says whether to email now); a failure seen while a run is
 * going, such as the result of our own retry, changes nothing but the count.
 */
export function onPaymentFailed(state: DunningState, now: Date, s: DunningSettings, stripeAttempt = 0): { state: DunningState; started: boolean } {
  if (state.startedAt) return { state: { ...state, attempts: Math.max(state.attempts, stripeAttempt) }, started: false }
  const startedAt = now.toISOString()
  return {
    started: true,
    state: { startedAt, attempts: Math.max(1, stripeAttempt), nextAt: retryAt(startedAt, 0, s), graceEndsAt: iso(now.getTime() + s.dunningGraceDays * DAY) },
  }
}

export type DunningAction = 'none' | 'retry' | 'end'

/** What the sweep should do now. A retry is only due inside the grace period; once it is over the run ends. */
export function dueAction(state: DunningState, now: Date): DunningAction {
  if (!state.startedAt) return 'none'
  const t = now.getTime()
  if (state.graceEndsAt && t >= Date.parse(state.graceEndsAt)) return 'end'
  if (state.nextAt && t >= Date.parse(state.nextAt)) return 'retry'
  return 'none'
}

/** After a retry and reminder were sent: count it and set the next one, or none when the schedule is done. */
export function afterRetry(state: DunningState, s: DunningSettings): DunningState {
  if (!state.startedAt) return state
  const done = state.attempts // the first failure counted as attempt 1, so retry n is the (n+1)th attempt
  return { ...state, attempts: state.attempts + 1, nextAt: retryAt(state.startedAt, done, s) }
}

/** True when the member should still have access: past due, inside the grace period. */
export const inGrace = (m: Pick<MembershipDoc, 'status' | 'graceEndsAt'>, now: Date): boolean =>
  m.status === 'past-due' && Boolean(m.graceEndsAt) && now.getTime() < Date.parse(String(m.graceEndsAt))

export type DunningEmailKind = 'failed' | 'retry' | 'ended' | 'downgraded' | 'recovered'

/** The site's own wording for one dunning email (Members, Emails), falling back to the built-in text for a blank subject or body. */
export function dunningWording(kind: DunningEmailKind, emails: Record<string, unknown> | null | undefined): { subject: string; body: string } {
  const base = DUNNING_EMAILS[kind]
  const key = kind.charAt(0).toUpperCase() + kind.slice(1)
  const subject = emails?.[`dunning${key}Subject`]
  const body = emails?.[`dunning${key}Body`]
  return { subject: typeof subject === 'string' && subject.trim() ? subject.trim() : base.subject, body: typeof body === 'string' && body.trim() ? body.trim() : base.body }
}

/** The wording. {{tags}} are filled per member; the link lets them update the card. */
export const DUNNING_EMAILS: Record<DunningEmailKind, { subject: string; body: string }> = {
  failed: { subject: 'Your {{tier}} payment did not go through', body: 'Hi {{name}},\n\nWe could not take the payment for your {{tier}} membership. You keep your access until {{graceEnds}} while we try again.\n\nPlease update your card here:\n{{link}}\n\n{{siteName}}' },
  retry: { subject: 'We tried your {{tier}} payment again', body: 'Hi {{name}},\n\nWe tried your card again for your {{tier}} membership and it did not go through. Your access continues until {{graceEnds}}.\n\nPlease update your card here:\n{{link}}\n\n{{siteName}}' },
  ended: { subject: 'Your {{tier}} membership has ended', body: 'Hi {{name}},\n\nWe could not take the payment for your {{tier}} membership, so it has ended.\n\nYou can join again any time:\n{{link}}\n\n{{siteName}}' },
  downgraded: { subject: 'Your membership has moved to {{freeTier}}', body: 'Hi {{name}},\n\nWe could not take the payment for your {{tier}} membership, so your account has moved to {{freeTier}}.\n\nYou can upgrade again any time:\n{{link}}\n\n{{siteName}}' },
  recovered: { subject: 'Thanks, your payment went through', body: 'Hi {{name}},\n\nYour {{tier}} membership payment went through and everything is back to normal.\n\n{{siteName}}' },
}
