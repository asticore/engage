import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { ConfirmIdentityPanel } from '@/features/security/components/ConfirmIdentityPanel.nossr'

/** /admin/security/confirm: the step-up confirmation asked for before an administrator is added. */
export async function ConfirmIdentityView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))

  return (
    <div style={{ maxWidth: 640, padding: '1.5rem' }}>
      <h1>Confirm it is you</h1>
      <p>Adding an administrator needs your password or an authenticator code again. The confirmation lasts ten minutes, then save the user.</p>
      <ConfirmIdentityPanel />
    </div>
  )
}
