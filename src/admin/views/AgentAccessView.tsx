import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { AgentAccessPanel } from '@/features/agentAccess/components/AgentAccessPanel'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/agent-access: scoped, capped, revocable tokens for connected AI tools, and their activity log. Admin only. */
export async function AgentAccessView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage AI agent access.</p>
  if (!(await getFeatureFlags()).agents) return <p>Switch AI agent access on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">AI agent access</h1>
        <p className="settings-page__description">
          Give a connected AI tool its own token for the admin API. Each token has only the access you pick, can never delete, stops at a daily cap, can be revoked at once, and every request it makes is logged here.
        </p>
      </div>
      <AgentAccessPanel />
    </div>
  )
}

export default AgentAccessView
