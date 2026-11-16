import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { SsoPanel } from '@/features/orgSso/components/SsoPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/sso: single sign-on per organisation. Admin only. */
export async function SsoView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage single sign-on.</p>
  if (!(await getFeatureFlags()).sso) return <p>Switch Single sign-on on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Single sign-on</h1>
        <p className="settings-page__description">Let an organisation&apos;s people sign in with their own OpenID Connect identity provider. Prove each email domain with a DNS record first, then switch the connection on.</p>
      </div>
      <SsoPanel />
    </div>
  )
}

export default SsoView
