/**
 * Gift wrap (Task 23c): an optional flat fee the admin sets in Shop switches. Off by default. The shopper ticks it at
 * checkout; the server adds the fee to the order total, taxes it like shipping and records it in the order's shipping
 * total and note, so refunds, invoices and reports need no change.
 */

export type GiftWrapSettings = { enabled: boolean; feeCents: number }

export const GIFT_WRAP_NOTE = 'Gift wrap requested.'

export function normaliseGiftWrap(doc: unknown): GiftWrapSettings {
  const d = (doc ?? {}) as { giftWrapEnabled?: unknown; giftWrapFee?: unknown }
  const fee = typeof d.giftWrapFee === 'number' && Number.isFinite(d.giftWrapFee) ? Math.round(d.giftWrapFee * 100) : 0
  const feeCents = Math.min(100_000, Math.max(0, fee))
  return { enabled: d.giftWrapEnabled === true && feeCents > 0, feeCents }
}

/** The fee to charge: only when the shop offers it and the shopper asked for it. */
export function giftWrapFee(settings: GiftWrapSettings, requested: unknown): number {
  return settings.enabled && requested === true ? settings.feeCents : 0
}

/** The order note with a gift wrap line added when it was chosen. */
export function withGiftWrapNote(note: string | null | undefined, fee: number): string | null {
  if (fee <= 0) return note ?? null
  return note ? `${note}\n${GIFT_WRAP_NOTE}` : GIFT_WRAP_NOTE
}
