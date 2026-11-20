import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { BulkCreatePanel } from '@/features/bulkCreate/BulkCreatePanel.nossr'

/** /admin/bulk-create: make many draft pages, posts or products at once from a list or CSV. */
export async function BulkCreateView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  const can = context.can as unknown as (resource: string, action: string) => boolean
  if (!context.isAdmin && !can('pages', 'create') && !can('posts', 'create') && !can('products', 'create')) return <p>You do not have permission to create content.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Bulk create</h1>
        <p className="settings-page__description">Paste a list of titles or upload a CSV to make many drafts at once. You see the plan and any clashes first, and you can undo the batch.</p>
      </div>
      <BulkCreatePanel />
    </div>
  )
}

export default BulkCreateView
