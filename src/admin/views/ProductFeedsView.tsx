import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { ProductFeedsPanel } from '@/features/ecommerce/admin/ProductFeedsPanel.nossr'

/** /admin/product-feeds: feeds for Google, Meta, Pinterest and others, each with a secret address. Admin only. */
export async function ProductFeedsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage product feeds.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Product feeds</h1>
        <p className="settings-page__description">Give each shopping channel its own feed address, with its own currency, price tier and product filters. Keep the addresses private: anyone with an address can read that feed.</p>
      </div>
      <ProductFeedsPanel />
    </div>
  )
}

export default ProductFeedsView
