import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { PricingPreviewPanel } from '@/features/ecommerce/admin/PricingPreviewPanel.nossr'

/** /admin/pricing-preview: what a customer would pay for a cart, using the real checkout calculation. Admin only. */
export async function PricingPreviewView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can use the pricing preview.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Pricing preview</h1>
        <p className="settings-page__description">Pick a customer and a cart to see what they would pay, with the price tiers and pricing rules that apply. Nothing is saved or sent.</p>
      </div>
      <PricingPreviewPanel />
    </div>
  )
}

export default PricingPreviewView
