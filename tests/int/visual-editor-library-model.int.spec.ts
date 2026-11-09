import { describe, expect, it } from 'vitest'

import { BLOCK_CATEGORIES, libraryCards } from '@/views/visualEditor/blockSchemas'
import { libraryCategories, rankCards } from '@/views/visualEditor/libraryModel'
import { listItemIndexAt, previewLooksEmpty } from '@/views/visualEditor/emptyPreview'

const card = (slug: string, label: string, category = 'basic', description = '') => ({ slug, label, category, description })

describe('library categories', () => {
  it('merges "X" and "X elements" and drops empty categories', () => {
    const cats = [
      { key: 'layout', label: 'Layout' },
      { key: 'el:layout', label: 'Layout elements' },
      { key: 'media', label: 'Media' },
      { key: 'el:media', label: 'Media elements' },
      { key: 'formFields', label: 'Form fields' },
    ]
    const cards = [card('a', 'A', 'layout'), card('b', 'B', 'el:layout'), card('c', 'C', 'el:media')]
    const out = libraryCategories(cats, cards)
    expect(out.map((c) => [c.label, c.count])).toEqual([['Layout', 2], ['Media', 1]])
    expect(out[0].keys).toEqual(['layout', 'el:layout'])
  })

  it('has unique names and no empty entries for the real library', () => {
    const out = libraryCategories(BLOCK_CATEGORIES, libraryCards())
    const names = out.map((c) => c.label.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    expect(out.every((c) => c.count > 0)).toBe(true)
  })
})

describe('library search ranking', () => {
  it('ranks label word-starts before descriptions and ignores partial description words', () => {
    const cards = [
      card('element:table', 'Table', 'basic', 'A table with a header row'),
      card('element:heading', 'Heading', 'basic', 'A title'),
      card('element:menu', 'Menu', 'basic', 'Headline links'),
      card('element:note', 'Note', 'basic', 'A head note for the page'),
    ]
    expect(rankCards(cards, 'head').map((c) => c.label)).toEqual(['Heading', 'Note'])
  })

  it('puts an exact label first and keeps order for an empty query', () => {
    const cards = [card('element:button-group', 'Button group'), card('element:button', 'Button'), card('x', 'Zed')]
    expect(rankCards(cards, 'button')[0].label).toBe('Button')
    expect(rankCards(cards, '  ').map((c) => c.label)).toEqual(['Button group', 'Button', 'Zed'])
  })

  it('requires every word', () => {
    const cards = [card('element:image-box', 'Image box'), card('element:image', 'Image')]
    expect(rankCards(cards, 'image box').map((c) => c.label)).toEqual(['Image box'])
  })

  it('"head" finds Heading first in the real library and not Table / Slides / Menu', () => {
    const out = rankCards(libraryCards(), 'head').map((c) => c.label)
    expect(out[0]).toBe('Heading')
    for (const bad of ['Table', 'Slides', 'Menu']) expect(out).not.toContain(bad)
  })
})

describe('empty preview detection', () => {
  it('flags zero height and empty slivers, not content', () => {
    expect(previewLooksEmpty({ height: 0, text: '', hasMedia: false })).toBe(true)
    expect(previewLooksEmpty({ height: 8, text: '  ', hasMedia: false })).toBe(true)
    expect(previewLooksEmpty({ height: 8, text: 'Hi', hasMedia: false })).toBe(false)
    expect(previewLooksEmpty({ height: 8, text: '', hasMedia: true })).toBe(false)
    expect(previewLooksEmpty({ height: 120, text: '', hasMedia: false })).toBe(false)
  })
})

describe('list item under pointer', () => {
  it('picks the item by geometry (the preview itself ignores the pointer)', () => {
    document.body.innerHTML = '<ul id="u"><li>a</li><li>b<ul><li>nested</li></ul></li></ul>'
    const items = Array.from(document.querySelectorAll('li'))
    const box = (top: number, bottom: number) => ({ left: 0, right: 100, top, bottom, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    items[0].getBoundingClientRect = () => box(0, 20)
    items[1].getBoundingClientRect = () => box(20, 80)
    items[2].getBoundingClientRect = () => box(50, 70)
    const root = document.getElementById('u')!
    expect(listItemIndexAt(root, 10, 10)).toBe(0)
    expect(listItemIndexAt(root, 10, 30)).toBe(1)
    expect(listItemIndexAt(root, 10, 60)).toBe(1)
    expect(listItemIndexAt(root, 500, 500)).toBe(0)
  })
})
