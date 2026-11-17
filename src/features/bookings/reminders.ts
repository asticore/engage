import { reminderEmail } from './service'
import * as store from './store'

/** How long before the start the reminder goes out. */
export const REMINDER_LEAD_MS = 24 * 3_600_000

export type SendFn = (mail: { to: string; template: string; subject: string; text: string; html: string }) => Promise<unknown>

/**
 * Emails each confirmed booking starting within the next 24 hours once. The booking is marked first, so a crash
 * or an overlapping run can miss a reminder but never sends two. A booking made less than a day ahead is
 * reminded on the next run. Never throws: a missing table or a failed email must not fail the cron run.
 */
export async function runBookingReminders(d1: store.D1, now: Date, siteName: string, send: SendFn): Promise<number> {
  let sent = 0
  try {
    const due = await store.dueReminders(d1, now.getTime(), REMINDER_LEAD_MS)
    for (const booking of due) {
      try {
        const type = await store.getType(d1, booking.typeId)
        await store.markReminded(d1, booking.id, now.toISOString())
        await send({ to: booking.customerEmail, template: 'booking.reminder', ...reminderEmail(booking, type?.title ?? 'Your booking', siteName) })
        sent += 1
      } catch {
        // One failed email does not stop the rest.
      }
    }
  } catch {
    // Bookings not set up yet.
  }
  return sent
}
