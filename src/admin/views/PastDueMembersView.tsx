import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { PastDuePanel } from '@/features/members/PastDuePanel.nossr'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/past-due-members: members whose renewal payment failed. Admin only. */
export async function PastDueMembersView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can see past due members.</p>
  if (!(await getFeatureFlags()).members) return <p>Switch Members on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Past due members</h1>
        <p className="settings-page__description">Members whose renewal payment failed, how far the chase has got, and a way to retry the card or end it.</p>
      </div>
      <PastDuePanel />
    </div>
  )
}

export default PastDueMembersView
