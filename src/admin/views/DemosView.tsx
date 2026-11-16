import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { DemosPanel } from '@/features/demos/components/DemosPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/demos: save a demo copy, reset it, make view-only accounts and download the package. Admin only. */
export async function DemosView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage demos.</p>
  if (!(await getFeatureFlags()).demos) return <p>Switch Agency demos on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Agency demos</h1>
        <p className="settings-page__description">Use this site as a demo for clients. Save the demo as a copy, put it back to that copy by hand or on a schedule, give a client a view-only account, and download the copy as a package to import on their own site later.</p>
      </div>
      <DemosPanel />
    </div>
  )
}

export default DemosView
