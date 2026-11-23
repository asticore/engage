import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { BUILT_IN_FONTS, sanitizeInstalledFonts } from '@/features/fonts/installed'
import { loadThemeStyles } from '@/features/themeStyles/store'
import { buildEntries, type EntryDoc } from '@/features/templatesHub/entryPoints'
import { TemplateEntryButtons } from '@/features/templatesHub/admin/TemplateEntryButtons'
import { ThemeStylesClient } from './ThemeStylesClient.nossr'

/**
 * Server wrapper for /admin/theme-styles. Administrators only. Loads the saved
 * styles directly (no HTTP hop) plus the installed fonts for the font picker.
 */
export async function ThemeStylesView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))
  if (!context.isAdmin) redirect(adminHref('', await getAdminRoot()))

  const { styles, saved } = await loadThemeStyles()
  const settings = (await (context.engine as unknown as { findGlobal: (args: Record<string, unknown>) => Promise<{ theme?: { customFonts?: unknown } } | null> })
    .findGlobal({ slug: 'site-settings', depth: 0, user: context.user })
    .catch((): null => null)) ?? null
  const builtInIds = new Set(BUILT_IN_FONTS.map((font) => font.value))
  const fonts = sanitizeInstalledFonts(settings?.theme?.customFonts)
    .filter((font) => !builtInIds.has(font.id))
    .map((font) => ({ id: font.id, label: font.family }))

  // Blog, shop, product, header and footer are templates: these buttons open each one in the visual builder.
  const found = (await context.engine
    .find({ collection: 'site-templates', depth: 0, limit: 200, user: context.user } as never)
    .catch((): { docs?: unknown[] } => ({}))) as { docs?: unknown[] }
  const entries = buildEntries((found.docs ?? []) as EntryDoc[])

  return (
    <>
      <TemplateEntryButtons entries={entries} />
      <ThemeStylesClient initialStyles={styles} saved={saved} fonts={fonts} />
    </>
  )
}