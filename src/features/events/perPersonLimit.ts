import { normaliseEmail } from '@/features/purchaseLimits/logic'

type Row = { email?: unknown; guestCount?: unknown }

const guestsOf = (row: Row): number => (typeof row.guestCount === 'number' && row.guestCount > 0 ? row.guestCount : 1)

/**
 * The event's "most places per person" rule. Returns the refusal text, or null when the booking may go ahead.
 * Bookings are matched by email with the same normalising as purchase limits (case and `+tag` do not make a new person).
 * `active` is the event's bookings that still count (not cancelled). A blank or 0 limit means no limit. Pure.
 */
export function perPersonRefusal(max: unknown, active: Row[], incomingEmail: unknown, incomingGuests: number): string | null {
  const limit = typeof max === 'number' && Number.isFinite(max) ? Math.floor(max) : 0
  if (limit <= 0 || typeof incomingEmail !== 'string' || !incomingEmail.trim()) return null
  const key = normaliseEmail(incomingEmail)
  const booked = active.filter((row) => typeof row.email === 'string' && normaliseEmail(row.email) === key).reduce((sum, row) => sum + guestsOf(row), 0)
  if (booked + incomingGuests <= limit) return null
  const left = Math.max(limit - booked, 0)
  return left === 0
    ? `Sorry, each person can book up to ${limit} place${limit === 1 ? '' : 's'} on this event and you have already booked them.`
    : `Sorry, each person can book up to ${limit} place${limit === 1 ? '' : 's'} on this event. You can book ${left} more.`
}
