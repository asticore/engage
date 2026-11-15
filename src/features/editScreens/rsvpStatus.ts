import type { CollectionBeforeChangeHook } from '@/engine'

/** True for a booking that still holds its places. Rows from before the status column read as confirmed. */
export const isActiveRsvp = (row: { status?: unknown }): boolean => row.status !== 'cancelled'

/** Keeps only the bookings that hold places. Every capacity and ticket type count goes through this. */
export const activeRsvps = <T extends { status?: unknown }>(rows: T[]): T[] => rows.filter(isActiveRsvp)

/** Stamps the time a booking is cancelled, and clears it if the booking is put back. */
export const stampCancellation: CollectionBeforeChangeHook = async ({ data }) => {
  if (!data) return data
  if (data.status === 'cancelled' && !data.cancelledAt) data.cancelledAt = new Date().toISOString()
  if (data.status === 'confirmed') data.cancelledAt = null
  return data
}
