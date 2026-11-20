import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext } from '@/admin/auth'
import { AssetManagerPanel } from '@/features/dam/AssetManagerPanel.nossr'
import { getFeatureFlags } from '@/utilities/features'

/** /admin/asset-manager: collections, custom metadata fields, licence expiry and the asset manager settings. Admin only. */
export async function AssetManagerView() {
  const context = await getAdminContext()
  if (!context.user) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) return <p>Only an admin can manage the asset manager.</p>
  if (!(await getFeatureFlags()).dam) return <p>Switch Asset manager on in Site Settings, under Features, to use this page.</p>
  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Asset manager</h1>
        <p className="settings-page__description">Collections, custom details, licences and rules for your media files.</p>
      </div>
      <AssetManagerPanel />
    </div>
  )
}

export default AssetManagerView
