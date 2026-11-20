import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { FrontendAssetsPanel } from '@/features/frontendAssets/components/FrontendAssetsPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/frontend-files: extra CSS and JavaScript for the public site and portal. Admin only. */
export async function FrontendAssetsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can change the front-end files.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Front-end files</h1>
        <p className="settings-page__description">Add stylesheets and scripts from other websites, such as Bootstrap, Tailwind or Font Awesome, to your public site and customer portal. Shine and Spark are loaded from their releases for you.</p>
      </div>
      <FrontendAssetsPanel />
    </div>
  )
}

export default FrontendAssetsView
