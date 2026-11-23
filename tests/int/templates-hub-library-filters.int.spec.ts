// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildHubRows, holdsPopup } from '@/features/templatesHub/rows'
import { EMPTY_LIBRARY_FILTER, filterLibraryItems, libraryTypes, libraryValues } from '@/features/templateLibraries/filter'
import { validateLibraryManifest } from '@/features/templateLibraries/manifest'
import type { LibraryItemRow } from '@/features/templateLibraries/types'

const popupSection = { blockType: 'section', design: { layout: { display: 'modal' } }, columns: [] as unknown[] }
const plainSection = { blockType: 'section', columns: [] as unknown[] }

describe('templates hub: popups and global widgets', () => {
  it('detects a reusable section shown as a popup', () => {
    expect(holdsPopup([popupSection])).toBe(true)
    expect(holdsPopup([plainSection])).toBe(false)
    expect(holdsPopup(null)).toBe(false)
  })

  it('lists popups apart from other reusable sections', () => {
    const rows = buildHubRows({ reusableSections: [{ id: 1, name: 'Offer', blocks: [popupSection] }, { id: 2, name: 'Card', blocks: [plainSection] }] })
    expect(rows.map((r) => r.type)).toEqual(['popup', 'reusable-section'])
    expect(rows[0].typeLabel).toBe('Popup')
  })
})

const lib = (extra: Record<string, unknown> = {}) => ({
  format: 'engage-library',
  schemaVersion: 1,
  name: 'Lib',
  items: [{ slug: 'shop-dark', kind: 'page', title: 'Shop', category: 'Shop', preview: 'p.png', file: 'i.json', ...extra }],
})

describe('library item metadata', () => {
  it('reads type, industry, style, theme and a dark preview', () => {
    const result = validateLibraryManifest(lib({ type: 'shop-page', industry: 'Retail', style: 'Ocean', theme: 'dark', previewDark: 'p-dark.png' }))
    expect(result.ok).toBe(true)
    expect(result.value?.items[0]).toMatchObject({ type: 'shop-page', industry: 'Retail', style: 'Ocean', theme: 'dark', previewDark: 'p-dark.png' })
  })

  it('refuses a bad type or theme', () => {
    expect(validateLibraryManifest(lib({ type: 'banner' })).ok).toBe(false)
    expect(validateLibraryManifest(lib({ theme: 'neon' })).ok).toBe(false)
  })

  const row = (over: Partial<LibraryItemRow>): LibraryItemRow => ({
    key: 'a', libraryId: 'l', libraryLabel: 'L', slug: 'a', title: 'A', kind: 'page', category: 'Shop', tags: [], previewUrl: '',
    type: 'page', industry: '', style: '', theme: 'both', previewDarkUrl: '', pairWith: '', siteKind: '', ...over,
  })

  it('filters by type, industry, style and light or dark', () => {
    const items = [
      row({ key: '1', type: 'shop-page', theme: 'dark', industry: 'Retail', style: 'Ocean' }),
      row({ key: '2', type: 'shop-page', theme: 'light', industry: 'Retail', style: 'Sand' }),
      row({ key: '3', type: 'header', theme: 'both' }),
    ]
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, type: 'shop-page', theme: 'dark' }).map((i) => i.key)).toEqual(['1'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, theme: 'light' }).map((i) => i.key)).toEqual(['2', '3'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, style: 'sand' }).map((i) => i.key)).toEqual(['2'])
    expect(libraryTypes(items)).toEqual(['shop-page', 'header'])
    expect(libraryValues(items, 'industry')).toEqual(['Retail'])
  })
})

describe('library item kinds from the templates repo draft (33c)', () => {
  const base = { slug: 'x', title: 'X', category: 'Shop', preview: 'p.png', file: 'i.json' }
  const make = (items: Array<Record<string, unknown>>, schemaVersion = 2) => ({ format: 'engage-library', schemaVersion, name: 'L', items })

  it('accepts schemaVersion 2 and lists new kinds as sections with a type', () => {
    const result = validateLibraryManifest(make([
      { ...base, slug: 'shop', kind: 'site-template', siteKind: 'archive-shop' },
      { ...base, slug: 'card', kind: 'loop' },
      { ...base, slug: 'offer', kind: 'popup' },
    ]))
    expect(result.ok).toBe(true)
    expect(result.value?.items.map((i) => [i.kind, i.type, i.siteKind])).toEqual([
      ['section', 'site-template', 'archive-shop'],
      ['section', 'loop', 'loop'],
      ['section', 'popup', undefined],
    ])
  })

  it('refuses an unknown siteKind and a pairWith that is not in the library', () => {
    expect(validateLibraryManifest(make([{ ...base, kind: 'site-template', siteKind: 'sidebar-top' }])).ok).toBe(false)
    expect(validateLibraryManifest(make([{ ...base, kind: 'section', pairWith: 'other' }])).ok).toBe(false)
    expect(validateLibraryManifest(make([{ ...base, kind: 'section', pairWith: 'y' }, { ...base, slug: 'y', kind: 'section', pairWith: 'x' }])).ok).toBe(true)
  })
})

import { pickThemeVariant } from '@/features/templateLibraries/list'

describe('light and dark twins (leftover 4)', () => {
  const light = { slug: 'a', theme: 'light', pairWith: 'a-dark' } as never
  const dark = { slug: 'a-dark', theme: 'dark', pairWith: 'a' } as never
  const both = { slug: 'b', theme: 'both' } as never
  it('uses the twin that matches the preferred theme', () => {
    expect(pickThemeVariant([light, dark], light, 'dark')).toBe(dark)
    expect(pickThemeVariant([light, dark], dark, 'light')).toBe(light)
    expect(pickThemeVariant([light, dark], light, 'light')).toBe(light)
    expect(pickThemeVariant([light, dark], light, '')).toBe(light)
    expect(pickThemeVariant([both], both, 'dark')).toBe(both)
  })
})
