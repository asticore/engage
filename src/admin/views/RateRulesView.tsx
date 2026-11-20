import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { RateRulesPanel } from '@/features/security/components/RateRulesPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/security/rate-rules: per-route rate limits. Admin only. */
export async function RateRulesView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage rate limit rules.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Rate limit rules</h1>
        <p className="settings-page__description">Limit how often one address can call a path, such as a form, a search or an API route. Setting SECURITY_RATE_RULES_OFF=1 in the environment switches the rules off if one ever blocks you.</p>
      </div>
      <RateRulesPanel />
    </div>
  )
}

export default RateRulesView
