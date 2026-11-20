import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { PurchaseLimitsPanel } from '@/features/purchaseLimits/PurchaseLimitsPanel.nossr'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/purchase-limits: per-person limits, waits between orders and the attempts they refused. Admin only. */
export async function PurchaseLimitsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage purchase limits.</p>
  if (!(await getFeatureFlags()).limits) return <p>Switch Purchase limits on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Purchase limits</h1>
        <p className="settings-page__description">Stop one person buying all the stock or tickets, and see what was refused.</p>
      </div>
      <PurchaseLimitsPanel />
    </div>
  )
}

export default PurchaseLimitsView
