import { notFound } from 'next/navigation'

import { ManageBooking } from '@/features/bookings/ManageBooking'
import { isManageToken } from '@/features/bookings/logic'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your booking', robots: { index: false, follow: false } }

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await getFeatureFlags()).bookings || !isManageToken(token)) notFound()
  return (
    <div className="page-shell">
      <h1>Your booking</h1>
      <ManageBooking token={token} />
    </div>
  )
}
