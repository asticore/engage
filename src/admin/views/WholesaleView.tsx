import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { WholesalePanel } from '@/features/ecommerce/components/WholesalePanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/shop/wholesale: wholesale applications and customer tags. Admin only. */
export async function WholesaleView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage wholesale accounts.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Wholesale</h1>
        <p className="settings-page__description">Approve wholesale applications and tag customers. Turn wholesale mode on, hide prices and set the minimum order in Shop switches.</p>
      </div>
      <WholesalePanel />
    </div>
  )
}

export default WholesaleView
