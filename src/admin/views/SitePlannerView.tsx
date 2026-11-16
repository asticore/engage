import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { SitePlannerPanel } from '@/features/sitePlanner/SitePlannerPanel'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/site-planner: plan the pages of a whole site, with a brief for each, then create draft pages. Admin only. */
export async function SitePlannerView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can use the site planner.</p>
  if (!(await getFeatureFlags()).siteplanner) return <p>Switch Site planner on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Site planner</h1>
        <p className="settings-page__description">Describe the site, get a page tree with a brief for each page, edit it, then create draft pages. Nothing is published.</p>
      </div>
      <SitePlannerPanel />
    </div>
  )
}

export default SitePlannerView
