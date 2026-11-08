import { describe, expect, it } from 'vitest'

import { commandEntries, filterFinder, nodeEntries, pageEditorHref, pageEntries, pagesSearchUrl, parsePagesResponse } from '@/views/visualEditor/finder'
import { resolveShortcut, SHORTCUT_LIST } from '@/views/visualEditor/useEditorShortcuts'

describe('finder shortcut', () => {
  it('Mod+E resolves to finder, plain E does not', () => {
    expect(resolveShortcut({ key: 'e', ctrl: true, meta: false, shift: false, alt: false })).toBe('finder')
    expect(resolveShortcut({ key: 'E', ctrl: false, meta: true, shift: false, alt: false })).toBe('finder')
    expect(resolveShortcut({ key: 'e', ctrl: false, meta: false, shift: false, alt: false })).toBeNull()
  })
  it('is listed in the shortcuts help', () => {
    expect(SHORTCUT_LIST.some((s) => s.keys === 'Mod+E' && s.labelKey === 've.shortcut.finder')).toBe(true)
  })
})

describe('finder entries and ranking', () => {
  const entries = [
    ...commandEntries([
      { command: 'save', label: 'Save draft', hint: 'Command' },
      { command: 'navigator', label: 'Navigator', hint: 'Command' },
    ]),
    ...nodeEntries([
      { path: [0], name: 'Section 1', typeLabel: 'Section', icon: 'S' },
      { path: [0, 0, 0], name: 'Heading: Save the date', typeLabel: 'Heading', icon: 'H' },
    ]),
  ]

  it('keeps order on an empty query', () => {
    expect(filterFinder(entries, '').map((e) => e.id)).toEqual(['command:save', 'command:navigator', 'node:0', 'node:0.0.0'])
  })

  it('ranks label prefix above a later match', () => {
    const ids = filterFinder(entries, 'save').map((e) => e.id)
    expect(ids[0]).toBe('command:save')
    expect(ids).toContain('node:0.0.0')
    expect(ids).not.toContain('node:0')
  })

  it('finds nodes by type hint', () => {
    expect(filterFinder(entries, 'heading').map((e) => e.id)).toEqual(['node:0.0.0'])
  })

  it('returns a node entry that carries its path', () => {
    const hit = filterFinder(entries, 'section')[0]
    expect(hit.kind === 'node' && hit.path).toEqual([0])
  })
})

describe('finder pages', () => {
  it('builds the search url with an encoded title filter', () => {
    expect(pagesSearchUrl(' about us ')).toBe('/api/pages?limit=20&depth=0&where[title][like]=about%20us')
    expect(pagesSearchUrl('')).toBe('/api/pages?limit=20&depth=0')
  })
  it('builds the editor link', () => {
    expect(pageEditorHref('/admin', 12)).toBe('/admin/visual-editor/collection/pages/12')
  })
  it('parses a response and drops the current page', () => {
    const rows = parsePagesResponse({ docs: [{ id: 1, title: 'Home' }, { id: '2', title: 'About' }, { title: 'bad' }, null] })
    expect(rows).toEqual([{ id: 1, title: 'Home' }, { id: '2', title: 'About' }])
    expect(pageEntries(rows, 'Page', '1').map((e) => e.id)).toEqual(['page:2'])
    expect(parsePagesResponse(null)).toEqual([])
  })
})
