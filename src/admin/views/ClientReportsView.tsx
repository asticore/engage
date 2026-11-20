import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { ClientReportsPanel } from '@/features/clientReports/components/ClientReportsPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/client-reports: read-only report links and scheduled report emails for clients. Admin only. */
export async function ClientReportsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage client reports.</p>
  if (!(await getFeatureFlags()).clientreports) return <p>Switch Client reports on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Client reports</h1>
        <p className="settings-page__description">Make a private read-only link for a client that shows sales, form entries and content for a period, with no sign-in. Email the same numbers weekly or monthly, or download them as CSV. Switch a link off or make a new one at any time. For the full charts use Shop reports and the Google dashboard.</p>
      </div>
      <ClientReportsPanel />
    </div>
  )
}

export default ClientReportsView
