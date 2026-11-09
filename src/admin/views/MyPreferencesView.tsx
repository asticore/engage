import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { getAdminUi } from '@/admin/i18n/serverUi'
import { MyPreferencesClient } from '@/admin/ui/MyPreferencesClient'

/**
 * Settings > My preferences: personal settings for whoever is signed in (interface language,
 * theme, replay the tour). Open to every user with admin panel access; it only ever reads and
 * writes the signed-in person's own user record.
 */
export async function MyPreferencesView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))

  const ui = await getAdminUi()
  const user = context.user as { id?: number | string; adminLanguage?: string | null } | null

  return (
    <div className="list-view">
      <div className="list-header">
        <h1>{ui.t('profile.title')}</h1>
      </div>
      <p>{ui.t('profile.description')}</p>
      <MyPreferencesClient adminLanguage={user?.adminLanguage} userId={user?.id} />
    </div>
  )
}

export default MyPreferencesView
