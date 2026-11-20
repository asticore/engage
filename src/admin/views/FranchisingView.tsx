import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { FranchisingPanel } from '@/features/franchising/components/FranchisingPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/franchising: franchises on their own domain and roll-out of shared page templates. Admin only. */
export async function FranchisingView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage franchises.</p>
  if (!(await getFeatureFlags()).franchising) return <p>Switch Franchising on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Franchising</h1>
        <p className="settings-page__description">Each franchise has its own domain and owner. Roll a shared page template out to every franchise as a locked page, and roll updates out again later. A franchise owner is an editor limited to their own domain, so they only see their own pages.</p>
      </div>
      <FranchisingPanel />
    </div>
  )
}

export default FranchisingView
