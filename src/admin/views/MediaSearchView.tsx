import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { MediaSearchPanel } from '@/features/dam/MediaSearchPanel.nossr'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/media-search: search the media library by every detail. Anyone who can read media. */
export async function MediaSearchView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin && !context.can('media', 'read')) return <p>You do not have access to the media library.</p>
  if (!(await getFeatureFlags()).dam) return <p>Switch Asset manager on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Media search</h1>
        <p className="settings-page__description">Find files by words, type, folder, tag, collection, size, date, shape, status, licence and your own details.</p>
      </div>
      <MediaSearchPanel />
    </div>
  )
}

export default MediaSearchView
