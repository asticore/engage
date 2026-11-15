import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { NotificationsPanel } from '@/features/notifications/NotificationsPanel'

/** /admin/notifications: rules that send an email or push when something happens. Admin only. */
export async function NotificationsView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can set up notifications.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Notifications</h1>
        <p className="settings-page__description">Send an email or a push notification when an order is paid, a form is sent, a booking is made, someone signs up and more. Fill the message with merge tags.</p>
      </div>
      <NotificationsPanel />
    </div>
  )
}

export default NotificationsView
