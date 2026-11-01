import { describe, expect, it } from 'vitest'

import { SETTINGS_PAGES } from '@/admin/settingsPages'
import { settingFields } from '@/admin/settings/settingsFields'
import { globalConfigs } from '@/localapi/registry'
import { settingFieldHelp } from '@/components/admin/nav/settingsDescriptions'

/**
 * Every editable field on a settings page has English help text, either in the
 * field config (`admin.description`) or in settingsDescriptions.ts. The other
 * languages come from the usual translation flow.
 */
describe('settings field help text', () => {
  it('every visible settings field has a description', () => {
    const missing: string[] = []
    for (const page of SETTINGS_PAGES) {
      for (const section of page.sections) {
        if (section.kind !== 'global') continue
        const config = globalConfigs.find((g) => g.slug === section.slug)
        expect(config, `global ${section.slug} on ${page.path}`).toBeDefined()
        for (const field of settingFields(config?.fields ?? [])) {
          if (field.hidden) continue
          if (field.description || settingFieldHelp(section.slug, field.path)) continue
          missing.push(`${section.slug}:${field.path}`)
        }
      }
    }
    expect(missing, `fields without help text:\n${missing.join('\n')}`).toEqual([])
  })
})
