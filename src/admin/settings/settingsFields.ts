import type { Field } from '@/engine'
import { fieldLabel, humanizeName } from '@/admin/fields/shared'
import { settingFieldHelp } from '@/components/admin/nav/settingsDescriptions'

/**
 * Helpers for the settings pages: help text, the search index and the
 * "Reset this section" defaults. They walk the field config the same way
 * `flattenDoc` does, so a path here is the same key the form uses.
 */

export type SettingField = {
  /** Dotted path the form stores the value under, for example `seo.metaTitle`. */
  path: string
  label: string
  description: string | null
  type: string
  hidden: boolean
  readOnly: boolean
  /** The config default, when the field has a plain one (functions are not defaults here). */
  defaultValue: unknown
  hasDefault: boolean
}

type Loose = {
  type?: unknown
  name?: unknown
  defaultValue?: unknown
  admin?: { description?: unknown; hidden?: unknown; readOnly?: unknown }
  fields?: Field[]
  tabs?: { name?: unknown; fields: Field[] }[]
}

const childPath = (base: string, name: string | undefined): string => (name ? (base ? `${base}.${name}` : name) : base)

/** Leaf fields only (groups, rows, tabs and collapsibles are containers). Arrays and blocks count as leaves, as in `flattenDoc`. */
export function settingFields(fields: Field[], basePath = ''): SettingField[] {
  const out: SettingField[] = []
  const walk = (list: Field[], base: string) => {
    for (const raw of list) {
      const field = raw as unknown as Loose
      switch (field.type) {
        case 'row':
        case 'collapsible':
          walk(field.fields ?? [], base)
          continue
        case 'group':
          walk(field.fields ?? [], childPath(base, typeof field.name === 'string' ? field.name : undefined))
          continue
        case 'tabs':
          for (const tab of field.tabs ?? []) walk(tab.fields, childPath(base, typeof tab.name === 'string' ? tab.name : undefined))
          continue
        case 'ui':
          continue
      }
      if (typeof field.name !== 'string' || !field.name) continue
      const path = childPath(base, field.name)
      const label = fieldLabel(raw)
      const hasDefault = field.defaultValue !== undefined && typeof field.defaultValue !== 'function'
      out.push({
        path,
        label: typeof label === 'string' ? label : humanizeName(field.name),
        description: typeof field.admin?.description === 'string' ? field.admin.description : null,
        type: String(field.type),
        hidden: Boolean(field.admin?.hidden),
        readOnly: Boolean(field.admin?.readOnly),
        defaultValue: hasDefault ? field.defaultValue : undefined,
        hasDefault,
      })
    }
  }
  walk(fields, basePath)
  return out
}

/**
 * Returns the fields with `admin.description` filled from settingsDescriptions.ts
 * where the config has none. `slug` is the global the fields belong to.
 */
export function settingsFieldsWithHelp(slug: string, fields: Field[]): Field[] {
  const withHelp = (list: Field[], base: string): Field[] =>
    list.map((raw) => {
      const field = raw as unknown as Loose & Record<string, unknown>
      if (field.type === 'row' || field.type === 'collapsible') {
        return { ...field, fields: withHelp(field.fields ?? [], base) } as unknown as Field
      }
      if (field.type === 'group') {
        const name = typeof field.name === 'string' ? field.name : undefined
        return { ...field, fields: withHelp(field.fields ?? [], childPath(base, name)) } as unknown as Field
      }
      if (field.type === 'tabs') {
        const tabs = (field.tabs ?? []).map((tab) => ({
          ...tab,
          fields: withHelp(tab.fields, childPath(base, typeof tab.name === 'string' ? tab.name : undefined)),
        }))
        return { ...field, tabs } as unknown as Field
      }
      if (field.type === 'ui' || typeof field.name !== 'string') return raw
      const path = childPath(base, field.name)
      const admin = (field.admin ?? {}) as Record<string, unknown>
      if (typeof admin.description === 'string' && admin.description) return raw
      const help = settingFieldHelp(slug, path)
      if (!help) return raw
      return { ...field, admin: { ...admin, description: help } } as unknown as Field
    })
  return withHelp(fields, '')
}

/**
 * Values for "Reset this section": the config default of every visible, editable
 * field that has one. Fields with no default keep what they hold, so a reset
 * never clears a value the config does not define a default for (API keys, for
 * example). Nothing is saved here; the form's own Save does that.
 */
export function resetDefaultsFor(fields: Field[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const field of settingFields(fields)) {
    if (!field.hasDefault || field.hidden || field.readOnly) continue
    if (/secret|password|token|api.?key/i.test(field.path)) continue
    out[field.path] = field.defaultValue
  }
  return out
}
