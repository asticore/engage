import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { LiveChatPanel } from '@/features/livechat/components/LiveChatPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/livechat: the staff inbox for live chat. Any admin or staff user. */
export async function LiveChatView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!hasAdminPanelAccess(context.user)) return <p>Only staff can use live chat.</p>
  if (!(await getFeatureFlags()).livechat) return <p>Switch Live chat on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Live chat</h1>
        <p className="settings-page__description">Keep this screen open to be shown as online. Visitors reach you from the chat widget, or after the chatbot hands off. Offline messages arrive here and your reply goes to the visitor by email.</p>
      </div>
      <LiveChatPanel />
    </div>
  )
}

export default LiveChatView
