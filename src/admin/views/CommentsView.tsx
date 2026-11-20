import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { CommentsPanel } from '@/features/comments/components/CommentsPanel.nossr'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/comments: moderate reader comments. Admin only. */
export async function CommentsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage comments.</p>
  if (!(await getFeatureFlags()).comments) return <p>Switch Comments on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Comments</h1>
        <p className="settings-page__description">Readers can comment on blog posts. Choose below whether every comment waits for you, only a first comment does, or comments with links do. Approve, mark as spam or delete in bulk, and reply as the site team.</p>
      </div>
      <CommentsPanel />
    </div>
  )
}

export default CommentsView
