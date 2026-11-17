import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { CspBuilderPanel } from '@/features/security/components/CspBuilderPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/security/csp: the guided Content-Security-Policy builder. Admin only. */
export async function CspBuilderView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can change the Content-Security-Policy.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Content-Security-Policy builder</h1>
        <p className="settings-page__description">Pick which sites may load scripts, styles, images, fonts and frames on your public pages. Test in report-only mode first and allow what browsers report with one click. The free-text policy in Security settings, Headers stays available.</p>
      </div>
      <CspBuilderPanel />
    </div>
  )
}

export default CspBuilderView
