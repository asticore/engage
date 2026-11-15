import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { MediaTagsPanel } from '@/features/mediaTags/MediaTagsPanel'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/media-tags: the tag tree for media files, with CSV import and export. Admin only. */
export async function MediaTagsView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage media tags.</p>
  if (!(await getFeatureFlags()).mediatags) return <p>Switch Media tags on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Media tags</h1>
        <p className="settings-page__description">Parent and child tags with colours for your files.</p>
      </div>
      <MediaTagsPanel />
    </div>
  )
}

export default MediaTagsView
