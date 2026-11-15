/**
 * Donation products: a simple product the buyer sets the amount of, with suggested amounts, a largest amount, a
 * campaign name, an optional "give anonymously" tick box and receipt wording for the confirmation email. Pure: the
 * storefront, the cart checks and the order email share these rules. Prices on products are whole dollars.
 */
import type { AddOnView } from './addOns'

export type DonationFields = {
  isDonation?: boolean | null
  donationAmounts?: string | null
  donationMax?: number | null
  donationCampaign?: string | null
  donationGoal?: number | null
  donationAnonymous?: boolean | null
  donationReceiptText?: string | null
}

export type DonationView = { amounts: number[]; max: number | null; campaign: string; goal: number | null; anonymous: boolean }

export const ANONYMOUS_ADD_ON_ID = 'donation-anonymous'

/** "10, 25, 50.50" to whole-dollar amounts: positive, at most `max`, no repeats, at most eight. */
export function parseAmounts(text: unknown, max: number | null = null): number[] {
  if (typeof text !== 'string') return []
  const seen = new Set<number>()
  for (const part of text.split(/[,;\s]+/)) {
    const n = Number(part.replace(/^\$/, ''))
    if (!Number.isFinite(n) || n <= 0 || (max !== null && n > max)) continue
    seen.add(Math.round(n * 100) / 100)
  }
  return [...seen].slice(0, 8)
}

export const isDonation = (product: DonationFields | null | undefined): boolean => product?.isDonation === true

const positive = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

export function donationView(product: DonationFields): DonationView | null {
  if (!isDonation(product)) return null
  const max = positive(product.donationMax)
  return {
    amounts: parseAmounts(product.donationAmounts, max),
    max,
    campaign: typeof product.donationCampaign === 'string' ? product.donationCampaign.trim().slice(0, 120) : '',
    goal: positive(product.donationGoal),
    anonymous: product.donationAnonymous === true,
  }
}

/** The tick box that is added to a donation's own add-ons when it offers anonymous giving. */
export const ANONYMOUS_ADD_ON: AddOnView = { id: ANONYMOUS_ADD_ON_ID, label: 'Give anonymously', description: null, inputType: 'checkbox', choices: [], required: false, priceCents: 0, priceMode: 'fixed', maxLength: 0 }

/** The product's add-on questions, plus the anonymous tick box for a donation that offers it. Used by the page and the server alike. */
export function withDonationAddOns(product: DonationFields, defs: AddOnView[]): AddOnView[] {
  return donationView(product)?.anonymous ? [...defs, ANONYMOUS_ADD_ON] : defs
}

/** Checks a donation amount in cents against the product's largest amount. The smallest is checked by validateNamedPrice. */
export function checkDonationMax(cents: number, product: DonationFields): string | null {
  const max = positive(product.donationMax)
  if (max !== null && cents > Math.round(max * 100)) return `The largest donation is ${max.toFixed(2)}.`
  return null
}

/** What an order line keeps about its donation, for the receipt and the campaign report. */
export type DonationLine = { campaign: string; receiptText: string }

export function donationLine(product: DonationFields): DonationLine | null {
  if (!isDonation(product)) return null
  return { campaign: typeof product.donationCampaign === 'string' ? product.donationCampaign.trim().slice(0, 120) : '', receiptText: typeof product.donationReceiptText === 'string' ? product.donationReceiptText.trim().slice(0, 1000) : '' }
}

type LineLike = { name?: string; lineCents?: number; donation?: DonationLine | null; addOns?: { id?: string }[] | null }

/** Receipt wording for the confirmation email: thanks per donation line, then each distinct receipt text once. Empty with no donation. */
export function donationReceipt(lineItems: unknown, format: (cents: number) => string): string {
  const lines = ((Array.isArray(lineItems) ? lineItems : []) as LineLike[]).filter((l) => l && l.donation)
  if (lines.length === 0) return ''
  const thanks = lines.map((l) => {
    const anon = (l.addOns ?? []).some((a) => a?.id === ANONYMOUS_ADD_ON_ID)
    const campaign = l.donation?.campaign
    return `Thank you for your donation of ${format(Number(l.lineCents) || 0)}${campaign ? ` to ${campaign}` : ''}${anon ? ' (given anonymously)' : ''}.`
  })
  const texts = [...new Set(lines.map((l) => l.donation?.receiptText ?? '').filter(Boolean))]
  return [...thanks, ...texts].join('\n')
}
