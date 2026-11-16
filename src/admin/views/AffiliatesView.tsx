import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { AffiliatesPanel } from '@/features/affiliates/components/AffiliatesPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/affiliates: partners with a referral link and the visits they bring. Admin only. */
export async function AffiliatesView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage affiliates.</p>
  if (!(await getFeatureFlags()).affiliates) return <p>Switch Affiliates on in Site Settings, under Features, to use this page.</p>
  const host = (await headers()).get('x-forwarded-host') ?? (await headers()).get('host') ?? ''
  const origin = host ? `https://${host}` : ''
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Affiliates</h1>
        <p className="settings-page__description">Each affiliate gets a link like yoursite.com/?ref=code. Visitors who arrive with it carry a cookie and each visit is logged. Orders they place earn a commission that becomes payable after the waiting days; refunds reduce it. Record payouts here after paying outside the site. Affiliates can apply at /affiliates and see their results on a private dashboard link (there is no sign-in for affiliates yet).</p>
      </div>
      <AffiliatesPanel origin={origin} />
    </div>
  )
}

export default AffiliatesView
