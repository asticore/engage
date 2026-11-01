import { describe, expect, it } from 'vitest'

import type { Field } from '@/engine'
import { resetDefaultsFor, settingFields, settingsFieldsWithHelp } from '@/admin/settings/settingsFields'
import { settingFieldHelp } from '@/components/admin/nav/settingsDescriptions'
import { globalConfigs } from '@/localapi/registry'
import { auditGlobalAfterChange } from '@/features/security/hooks'

const sample = [
  { name: 'siteName', type: 'text', defaultValue: 'Grace & Gatsby' },
  { name: 'notes', type: 'text' },
  { name: 'enabled', type: 'checkbox', defaultValue: false },
  { name: 'stamp', type: 'text', defaultValue: () => 'now', admin: { description: 'x' } },
  { name: 'hiddenThing', type: 'text', defaultValue: 'secret-default', admin: { hidden: true } },
  { name: 'apiKey', type: 'text', defaultValue: 'nope' },
  {
    type: 'group',
    name: 'seo',
    fields: [
      { name: 'metaTitle', type: 'text', defaultValue: 'Home' },
      { type: 'row', fields: [{ name: 'twitter', type: 'text', defaultValue: '@x' }] },
    ],
  },
  {
    type: 'tabs',
    tabs: [{ name: 'social', fields: [{ name: 'links', type: 'array', defaultValue: [] }] }],
  },
] as unknown as Field[]

describe('settings reset to defaults', () => {
  it('resets only fields that have a plain config default, visible and editable', () => {
    expect(resetDefaultsFor(sample)).toEqual({
      siteName: 'Grace & Gatsby',
      enabled: false,
      'seo.metaTitle': 'Home',
      'seo.twitter': '@x',
      'social.links': [],
    })
  })

  it('lists leaf fields with dotted paths, not containers', () => {
    const paths = settingFields(sample).map((f) => f.path)
    expect(paths).toEqual(['siteName', 'notes', 'enabled', 'stamp', 'hiddenThing', 'apiKey', 'seo.metaTitle', 'seo.twitter', 'social.links'])
  })

  it('fills help text from settingsDescriptions only where the config has none', () => {
    const fields = [{ name: 'siteName', type: 'text' }] as unknown as Field[]
    const withHelp = settingsFieldsWithHelp('site-settings', fields) as unknown as { admin?: { description?: string } }[]
    expect(withHelp[0].admin?.description).toBe(settingFieldHelp('site-settings', 'siteName'))
    const kept = settingsFieldsWithHelp('site-settings', [{ name: 'siteName', type: 'text', admin: { description: 'Own text' } }] as unknown as Field[]) as unknown as { admin?: { description?: string } }[]
    expect(kept[0].admin?.description).toBe('Own text')
  })
})

describe('settings saves are audited', () => {
  it('every global carries the settings audit hook', () => {
    for (const config of globalConfigs) {
      const hooks = (config.hooks as { afterChange?: unknown[] } | undefined)?.afterChange ?? []
      expect(hooks, `${config.slug} audit hook`).toContain(auditGlobalAfterChange)
    }
  })
})
