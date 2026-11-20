import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { BookingsAdminPanel } from '@/features/bookings/BookingsAdminPanel.nossr'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/bookings: booking types, who is booked and when they are open, and the bookings made. Admin only. */
export async function BookingsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage bookings.</p>
  if (!(await getFeatureFlags()).bookings) return <p>Switch Bookings on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Bookings</h1>
        <p className="settings-page__description">Set when you are open, add what people can book, and share the booking page. Customers get a confirmation with a link to cancel.</p>
      </div>
      <BookingsAdminPanel />
    </div>
  )
}

export default BookingsView
