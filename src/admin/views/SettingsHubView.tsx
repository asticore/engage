import { adminHref } from '@/features/security/adminPath'
import { getAdminRoot } from '@/features/security/settings'
import { redirect } from 'next/navigation'

import { getAdminContext, getGlobalConfig, hasAdminPanelAccess } from '@/admin/auth'
import { readFeatureFlags } from '@/components/admin/shared/resolveEntities'
import { isGlobalEnabled } from '@/features/registry'
import { sanitizeFieldsForClient } from '@/admin/fields/shared'
import { SETTINGS_PAGES, type GlobalSection } from '@/admin/settingsPages'
import { HUB_SCREENS } from '@/admin/settingsHub'
import { settingFields, settingsFieldsWithHelp } from '@/admin/settings/settingsFields'
import { SETTINGS_DESCRIPTIONS } from '@/components/admin/nav/settingsDescriptions'
import { SettingsHubClient, type HubItem, type HubPage } from './SettingsHubClient'

/**
 * /admin/settings: every settings screen in one place, with a search over the
 * settings themselves (label and help text). Only the pages and fields the
 * signed-in user can read are listed.
 */
export async function SettingsHubView() {
  const context = await getAdminContext()
  if (!hasAdminPanelAccess(context.user)) redirect(adminHref('/login', await getAdminRoot()))

  const flags = await readFeatureFlags(context.engine)
  const canRead = (slug: string) => Boolean(context.permissions.globals?.[slug]?.read) && isGlobalEnabled(slug, flags)

  const pages: HubPage[] = []
  const items: HubItem[] = []

  for (const page of SETTINGS_PAGES) {
    const globals = page.sections.filter((s): s is GlobalSection => s.kind === 'global')
    const readable = globals.filter((s) => canRead(s.slug) && getGlobalConfig(context.engine, s.slug))
    if (globals.length > 0 && readable.length === 0) continue

    const description = SETTINGS_DESCRIPTIONS[`settings-${page.key}`] ?? page.description
    pages.push({ key: page.key, title: page.title, href: page.path, description })
    items.push({ label: page.title, description, context: 'Settings page', href: page.path })

    for (const section of page.sections) {
      if (section.kind === 'link') {
        items.push({ label: section.label, description: section.description, context: page.title, href: section.href })
        continue
      }
      if (!readable.some((s) => s.slug === section.slug)) continue
      const config = getGlobalConfig(context.engine, section.slug)
      if (!config) continue
      const sectionLabel = typeof config.label === 'string' ? config.label : section.slug
      const fields = settingsFieldsWithHelp(section.slug, sanitizeFieldsForClient(config.fields))
      for (const field of settingFields(fields)) {
        if (field.hidden) continue
        items.push({
          label: field.label,
          description: field.description ?? '',
          context: `${page.title} > ${sectionLabel}`,
          href: `${page.path}#${section.slug}`,
        })
      }
    }
  }

  for (const screen of HUB_SCREENS) {
    items.push({ label: screen.label, description: screen.description, context: 'Other settings screens', href: screen.href })
  }

  return <SettingsHubClient pages={pages} screens={HUB_SCREENS} items={items} />
}

export default SettingsHubView
