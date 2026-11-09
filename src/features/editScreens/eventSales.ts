/**
 * What the event page offers a visitor: a sign-up, the ticket button, an outside link,
 * or "sold out". Pure, so the page and the tests share one rule.
 */

export type EventSaleInput = {
  eventType?: string | null
  externalRegistrationUrl?: string | null
  /** Places left on the whole event; null when there is no capacity. */
  spotsRemaining: number | null
  hasTicketProduct: boolean
}

export type EventSaleMode = 'external' | 'sold-out' | 'buy' | 'buy-soon' | 'rsvp'

export function eventSaleMode(input: EventSaleInput): EventSaleMode {
  if (input.externalRegistrationUrl) return 'external'
  if (input.spotsRemaining !== null && input.spotsRemaining <= 0) return 'sold-out'
  if (input.eventType === 'paid') return input.hasTicketProduct ? 'buy' : 'buy-soon'
  return 'rsvp'
}
