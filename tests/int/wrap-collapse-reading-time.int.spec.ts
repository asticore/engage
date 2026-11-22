import { describe, expect, it } from 'vitest'

import { asBlockStyle } from '@/lib/blockStyle'
import { countWords, readingTimeLabel } from '@/lib/mergeTags'

describe('wrapper link and read more options', () => {
  it('keeps a safe wrapper link and drops an unsafe one', () => {
    const ok = asBlockStyle({ wrapLink: '/pricing', wrapLinkNewTab: true, wrapLinkNoFollow: true, wrapLinkLabel: ' Pricing ' })
    expect(ok.wrapLink).toBe('/pricing')
    expect(ok.wrapLinkNewTab).toBe(true)
    expect(ok.wrapLinkLabel).toBe('Pricing')
    const bad = asBlockStyle({ wrapLink: 'javascript:alert(1)', wrapLinkNewTab: true })
    expect(bad.wrapLink).toBeUndefined()
    expect(bad.wrapLinkNewTab).toBeUndefined()
  })
  it('clamps the read more height and keeps button labels', () => {
    const s = asBlockStyle({ collapseHeight: 5000, collapseMore: 'More', collapseLess: 'Less' })
    expect(s.collapseHeight).toBe(1200)
    expect(s.collapseMore).toBe('More')
    expect(asBlockStyle({ collapseHeight: 'x', collapseMore: 'More' }).collapseMore).toBeUndefined()
  })
})

describe('reading time', () => {
  it('counts words in plain and rich text', () => {
    expect(countWords('one two  three')).toBe(3)
    expect(countWords({ root: { children: [{ text: 'a b' }, { children: [{ text: 'c' }] }] } })).toBe(3)
  })
  it('rounds to minutes with a minimum of one', () => {
    expect(readingTimeLabel('hello world')).toBe('1 min read')
    expect(readingTimeLabel('w '.repeat(660))).toBe('3 min read')
    expect(readingTimeLabel('')).toBe('')
  })
})
