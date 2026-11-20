import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { ChatbotPanel } from '@/features/chatbot/components/ChatbotPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/chatbot: set up the site chat assistant and read its conversations. Admin only. */
export async function ChatbotView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage the chatbot.</p>
  if (!(await getFeatureFlags()).chatbot) return <p>Switch Chatbot on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Chatbot</h1>
        <p className="settings-page__description">A chat assistant that answers from your FAQ first, then pages, posts and products, always with a link. It hands off to your contact page when it is not sure. Add a Claude or OpenAI key in Integrations to let it write answers; without one it answers from the FAQ only.</p>
      </div>
      <ChatbotPanel />
    </div>
  )
}

export default ChatbotView
