import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { listEmbedsForAdmin } from '@/features/forms/embedActions'
import { loadThemeStyles } from '@/features/themeStyles/store'
import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { getAdminUi } from '@/admin/i18n/serverUi'

import { ExternalEmbedsPanel, NewEmbedForm, type ThemeColour } from './ExternalEmbedsPanel'

/** /admin/external-embeds. Forms read permission to see it; the Forms integrations permission (or admin) to change it. */
export async function ExternalEmbedsView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  const ui = await getAdminUi()
  const result = await listEmbedsForAdmin()
  // The colours are the site's own palette (Theming > Colours): an embed picks one of these.
  let colours: ThemeColour[] = []
  try {
    const { styles } = await loadThemeStyles()
    colours = styles.colours.map((colour) => ({ id: colour.id, name: colour.name }))
  } catch {
    colours = []
  }
  return (
    <div className="list-view" style={{ maxWidth: 900, padding: '1.5rem' }}>
      <h1>{ui.t('extEmbeds.title')}</h1>
      {'error' in result ? (
        <p role="status">{result.error}</p>
      ) : (
        <>
          {result.forms.length === 0 ? <p className="doc-muted">{ui.t('extEmbeds.none')}</p> : null}
          <NewEmbedForm forms={result.forms} colours={colours} />
          <ExternalEmbedsPanel rows={result.rows} canChange={result.canChange} colours={colours} />
        </>
      )}
    </div>
  )
}
