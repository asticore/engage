import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { TaskboardPanel } from '@/features/taskboard/TaskboardPanel'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/taskboard: Kanban boards with assignees. Needs the Taskboard feature switched on in Site Settings. */
export async function TaskboardView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  const on = (await getFeatureFlags()).taskboard
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Taskboard</h1>
        <p className="settings-page__description">Create tasks, give them to admin and staff users and drag them across the columns.</p>
      </div>
      {on ? <TaskboardPanel /> : <p>Switch the Taskboard on under Site Settings, Features.</p>}
    </div>
  )
}

export default TaskboardView
