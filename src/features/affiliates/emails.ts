import type { UiDictionary } from '@/features/uiStrings/keys'
import { translateWith } from '@/features/uiStrings/t'

/**
 * The emails an affiliate receives (Task 31c). Plain text, in the site's language (the default language when
 * Languages is on, English otherwise). The wording lives in the interface strings (`affiliate.email.*`), so it is
 * translated like the rest of the admin. Built from values only, so it can be tested without a mail provider.
 * Sending lives in service.ts.
 */
export type AffiliateEmail = { subject: string; text: string }

type Dict = Partial<UiDictionary> | null | undefined

const money = (cents: number): string => `$${(Math.max(0, cents) / 100).toFixed(2)}`

export function approvedEmail(v: { name: string; link: string; dashboard: string; commissionPct: number; cookieDays: number }, dict?: Dict): AffiliateEmail {
  return {
    subject: translateWith(dict, 'affiliate.email.approved.subject'),
    text: translateWith(dict, 'affiliate.email.approved.body', { name: v.name, pct: v.commissionPct, days: v.cookieDays, link: v.link, dashboard: v.dashboard }),
  }
}

export function commissionEmail(v: { name: string; orderId: number; amountCents: number; payableOn: string; dashboard: string }, dict?: Dict): AffiliateEmail {
  return {
    subject: translateWith(dict, 'affiliate.email.commission.subject', { amount: money(v.amountCents) }),
    text: translateWith(dict, 'affiliate.email.commission.body', { name: v.name, order: v.orderId, amount: money(v.amountCents), date: v.payableOn.slice(0, 10), dashboard: v.dashboard }),
  }
}

export function payoutEmail(v: { name: string; amountCents: number; note: string; dashboard: string }, dict?: Dict): AffiliateEmail {
  // The reference string starts with a space, so it can follow the sentence before it.
  const reference = v.note ? translateWith(dict, 'affiliate.email.payout.reference', { note: v.note }) : ''
  return {
    subject: translateWith(dict, 'affiliate.email.payout.subject', { amount: money(v.amountCents) }),
    text: translateWith(dict, 'affiliate.email.payout.body', { name: v.name, amount: money(v.amountCents), reference, dashboard: v.dashboard }),
  }
}

/** Sent once when a commission's waiting period is over and it can be paid. */
export function payableEmail(v: { name: string; orderId: number; amountCents: number; dashboard: string }, dict?: Dict): AffiliateEmail {
  return {
    subject: translateWith(dict, 'affiliate.email.payable.subject', { amount: money(v.amountCents) }),
    text: translateWith(dict, 'affiliate.email.payable.body', { name: v.name, order: v.orderId, amount: money(v.amountCents), dashboard: v.dashboard }),
  }
}
