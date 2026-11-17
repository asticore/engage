import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { MyTasksPanel } from '@/features/taskboard/MyTasksPanel'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/my-tasks: the open tasks given to the signed-in person, from every board they can open. Needs the Taskboard feature. */
export async function MyTasksView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  const on = (await getFeatureFlags()).taskboard
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">My tasks</h1>
        <p className="settings-page__description">Open tasks given to you on every board you can open, soonest due first.</p>
      </div>
      {on ? <MyTasksPanel /> : <p>Switch the Taskboard on under Site Settings, Features.</p>}
    </div>
  )
}

export default MyTasksView
