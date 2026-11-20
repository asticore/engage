import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { UserBansPanel } from '@/features/security/components/UserBansPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/security/bans: ban and unban accounts. Admin only. */
export async function UserBansView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can ban users.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Banned accounts</h1>
        <p className="settings-page__description">Stop an account from signing in, with an internal reason and an optional end date. This is separate from the automatic lockout after too many wrong passwords.</p>
      </div>
      <UserBansPanel />
    </div>
  )
}

export default UserBansView
