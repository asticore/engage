import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { readAllClicks } from '@/features/ecommerce/outbound'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

const DAY_MS = 86_400_000

/** /admin/outbound-clicks: clicks on external and affiliate product buttons, all products, last 30 days. */
export async function OutboundClicksView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!(context.isAdmin || context.can('products', 'read'))) return <p>You do not have access to this report.</p>
  const from = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10)
  const rows = await readAllClicks(from)
  const total = rows.reduce((n, r) => n + r.clicks, 0)
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Outbound clicks</h1>
        <p className="settings-page__description">Clicks on the buy buttons of external and affiliate products in the last 30 days, by product and source. Counts only: no visitor is identified.</p>
      </div>
      <p>{total} clicks in total.</p>
      <table>
        <thead>
          <tr><th>Product</th><th>Source</th><th>Clicks</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.productId}-${r.source}`}><td>{r.title}</td><td>{r.source || 'direct'}</td><td>{r.clicks}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3}>No clicks yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export default OutboundClicksView
