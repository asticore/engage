// @vitest-environment node
// 16k: Extra field values and site-wide Options values can differ per language, and the merge tags
// ({{field:...}}, {{option:...}}) show the visitor's language. The builder picker lists both kinds.
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  locale: null as string | null,
  stored: {} as Record<string, Record<string, unknown>>,
}))

vi.mock('@/engine', () => ({
  getEngine: async () => ({
    find: async () => ({
      docs: [
        {
          id: 1,
          name: 'Contact',
          definition: [
            { label: 'Tagline', name: 'tagline', type: 'text' },
            { label: 'Hours', name: 'hours', type: 'textarea' },
            { label: 'Phone', name: 'phone', type: 'phone' },
          ],
          location: [[{ param: 'optionsPage', operator: 'equals', value: 'site-contact' }]],
        },
      ],
    }),
  }),
}))
vi.mock('@/features/customFields/options', async () => {
  const actual = await vi.importActual<typeof import('@/features/customFields/options')>('@/features/customFields/options')
  return { ...actual, getAllOptionValues: async () => state.stored }
})
vi.mock('@/features/multilingual/applyTranslations', () => ({ currentRequestLocale: async () => state.locale }))
vi.mock('@/features/blog/switches', () => ({ loadBlogSwitches: async () => ({ tags: true }) }))

import { L10N_KEY, defaultValuesOf, overridesOf, valuesForLocale } from '@/features/customFields/options'
import { loadOptionContext, buildDocumentTagContext } from '@/features/customFields/server'
import { fieldsForDocument } from '@/features/multilingual/translatableFields'
import { overlayDocument } from '@/features/multilingual/overlay'
import { optionsPagesOf, tagsFor } from '@/views/visualEditor/MergeTagPicker'

const row = { tagline: 'Hello', hours: 'Mon to Fri', phone: '555 0100', [L10N_KEY]: { fr: { tagline: 'Bonjour', hours: '  ', phone: 'x' }, it: 'bad' } }

describe('options values per language', () => {
  it('keeps the overrides out of the default form and drops empty and non-text junk', () => {
    expect(defaultValuesOf(row)).toEqual({ tagline: 'Hello', hours: 'Mon to Fri', phone: '555 0100' })
    expect(overridesOf(row)).toEqual({ fr: { tagline: 'Bonjour', phone: 'x' } })
  })
  it('lays a language over the defaults, and falls back for a language with nothing', () => {
    expect(valuesForLocale(row, 'fr')).toMatchObject({ tagline: 'Bonjour', hours: 'Mon to Fri' })
    expect(valuesForLocale(row, 'it')).toEqual({ tagline: 'Hello', hours: 'Mon to Fri', phone: '555 0100' })
    expect(valuesForLocale(row, null)).toEqual(defaultValuesOf(row))
  })
})

describe('{{option:...}} follows the visitor language', () => {
  it('uses the default language text, then the translated text', async () => {
    state.stored = { 'site-contact': row }
    const base = await loadOptionContext(undefined, null)
    expect(base['option:site-contact.tagline']).toBe('Hello')
    const fr = await loadOptionContext(undefined, 'fr')
    expect(fr['option:site-contact.tagline']).toBe('Bonjour')
    expect(fr['option:site-contact.hours']).toBe('Mon to Fri')
  })
  it('a page picks the language of the request', async () => {
    state.stored = { 'site-contact': row }
    state.locale = 'fr'
    const tags = await buildDocumentTagContext('pages', { id: 1, customFields: {} }, { needsOptions: true })
    expect(tags['option:site-contact.tagline']).toBe('Bonjour')
    state.locale = null
    const def = await buildDocumentTagContext('pages', { id: 1, customFields: {} }, { needsOptions: true })
    expect(def['option:site-contact.tagline']).toBe('Hello')
  })
})

describe('Extra field text on a document is translatable', () => {
  const page = { id: 7, title: 'Home', customFields: { tagline: 'Hello there', link: 'https://x.test', year: '2026-01-01', price: '12.50', note: '' } }
  it('lists the wording but not links, dates, numbers or empties', () => {
    const paths = fieldsForDocument('pages', page).map((f) => f.path)
    expect(paths).toContain('customFields.tagline')
    expect(paths).not.toContain('customFields.link')
    expect(paths).not.toContain('customFields.year')
    expect(paths).not.toContain('customFields.price')
    expect(paths).not.toContain('customFields.note')
    expect(fieldsForDocument('faqs', page).map((f) => f.path)).not.toContain('customFields.tagline')
  })
  it('the overlay swaps the value the {{field:tagline}} tag reads, and keeps it when there is none', () => {
    const fr = overlayDocument(page, 'pages', 7, (_s, path) => (path === 'customFields.tagline' ? 'Bonjour' : null), false) as typeof page
    expect(fr.customFields.tagline).toBe('Bonjour')
    expect(fr.customFields.link).toBe('https://x.test')
    const none = overlayDocument(page, 'pages', 7, () => null, false) as typeof page
    expect(none.customFields.tagline).toBe('Hello there')
  })
})

describe('the builder picker lists site-wide tags', () => {
  it('builds {{option:slug.name}} tags for an options page group', () => {
    const group = { id: 1, name: 'Contact', fields: [{ label: 'Tagline', name: 'tagline', type: 'text' as const }], location: [[{ param: 'optionsPage', operator: 'equals', value: 'site-contact' }]] }
    expect(optionsPagesOf(group as never)).toEqual(['site-contact'])
    expect(tagsFor(group.fields, 'site-contact.', 'option').map((t) => t.tag)).toEqual(['{{option:site-contact.tagline}}'])
    expect(tagsFor(group.fields, '').map((t) => t.tag)).toEqual(['{{field:tagline}}'])
  })
})
