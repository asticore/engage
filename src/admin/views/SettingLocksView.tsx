import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { SettingLocksPanel } from '@/features/roles/SettingLocksPanel'

/** /admin/design-locks: lock design settings in the visual builder and the email builder. Admin only. */
export async function SettingLocksView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can lock design settings.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Design locks</h1>
        <p className="settings-page__description">Lock fonts, colours, spacing and other settings, on the whole site, on one kind of block, on one template or in emails. Locked settings show a lock in the builder and cannot be changed by roles you do not name. Resetting a setting returns it to the theme.</p>
      </div>
      <SettingLocksPanel />
    </div>
  )
}

export default SettingLocksView
