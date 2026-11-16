import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { IpRulesPanel } from '@/features/security/components/IpRulesPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'

/** /admin/security/ip-lists: block or allow addresses and ranges. Admin only. */
export async function IpRulesView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage the IP lists.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">IP lists</h1>
        <p className="settings-page__description">Block an address or a range, or allow one that must always get in. The allow list wins over the block list, and you cannot block your own address. Setting SECURITY_IP_RULES_OFF=1 in the environment switches the lists off if you are ever locked out.</p>
      </div>
      <IpRulesPanel />
    </div>
  )
}

export default IpRulesView
