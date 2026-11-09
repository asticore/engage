import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { PriceTiersPanel } from '@/features/ecommerce/admin/PriceTiersPanel'
import { PriceTiersHeading } from '@/features/ecommerce/admin/PriceTiersHeading'

/** /admin/price-tiers: prices by quantity and customer type. Linked from Shop settings. */
export async function PriceTiersView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!(context.isAdmin || context.can('settings:shop-settings', 'read'))) return <p>You do not have access to the shop settings.</p>
  return (
    <div className="settings-page">
      <PriceTiersHeading />
      <PriceTiersPanel />
    </div>
  )
}

export default PriceTiersView
