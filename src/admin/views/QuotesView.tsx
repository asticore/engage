import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { QuotesAdminPanel } from '@/features/quotes/QuotesAdminPanel.nossr'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/quotes: requests for quotes, offers and items, and the quotes sent back. Admin only. */
export async function QuotesView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage quote requests.</p>
  if (!(await getFeatureFlags()).quotes) return <p>Switch Quotes and requests on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Quotes and requests</h1>
        <p className="settings-page__description">See what customers asked for, send a priced quote, and follow it to an order. Customers use the page /request-quote.</p>
      </div>
      <QuotesAdminPanel />
    </div>
  )
}

export default QuotesView
