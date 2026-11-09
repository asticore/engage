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
  const user = context.user as { id?: number | string; adminLanguage?: string | null; displayName?: string | null; photo?: number | string | { id?: number | string; url?: string | null } | null } | null
  let photoUrl: string | null = null
  const photoRef = user?.photo
  if (photoRef && typeof photoRef === 'object') photoUrl = photoRef.url ?? null
  else if (photoRef !== null && photoRef !== undefined && photoRef !== '') {
    const media = await context.engine.findByID({ collection: 'media', id: photoRef as number, depth: 0, overrideAccess: true }).catch((): null => null)
    photoUrl = (media as { url?: string | null } | null)?.url ?? null
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <h1>{ui.t('profile.title')}</h1>
      </div>
      <p>{ui.t('profile.description')}</p>
      <MyPreferencesClient adminLanguage={user?.adminLanguage} displayName={user?.displayName} photoUrl={photoUrl} userId={user?.id} />
    </div>
  )
}

export default MyPreferencesView
