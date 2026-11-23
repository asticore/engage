// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mapColourString, mapTemplateTokens, readColourMap } from '@/features/templateLibraries/themeMap'

const site = ['primary', 'accent', 'background', 'text']

describe('templates follow the theme (33d)', () => {
  it('turns a whole-value Shine token into the site colour reference', () => {
    expect(mapColourString('var(--sh-primary)', { siteColourIds: site })).toEqual({ value: 'var(--eg-c-primary)', mapped: 1 })
    expect(mapColourString('var(--shine-accent, #000)', { siteColourIds: site }).value).toBe('var(--eg-c-accent)')
  })

  it('leaves a token the site does not have, and plain colours, alone', () => {
    expect(mapColourString('var(--sh-brand)', { siteColourIds: site })).toEqual({ value: 'var(--sh-brand)', mapped: 0 })
    expect(mapColourString('#ffffff', { siteColourIds: site })).toEqual({ value: '#ffffff', mapped: 0 })
  })

  it('maps tokens inside longer values to the theme variable', () => {
    const out = mapColourString('linear-gradient(var(--sh-primary), var(--sh-accent))', { siteColourIds: site })
    expect(out.value).toBe('linear-gradient(var(--eg-c-primary), var(--eg-c-accent))')
    expect(out.mapped).toBe(2)
  })

  it('swaps listed fixed colours and ignores unsafe map entries', () => {
    const hexMap = readColourMap({ colours: { '#0A84FF': 'primary', 'red; x': 'accent', '#fff': 'Bad Id', '#111': 'text' } })
    expect(hexMap).toEqual({ '#0a84ff': 'primary', '#111': 'text' })
    expect(mapColourString('#0a84ff', { siteColourIds: site, hexMap }).value).toBe('var(--eg-c-primary)')
  })

  it('walks a whole tree without changing the input', () => {
    const tree = [{ blockType: 'section', design: { background: 'var(--sh-background)' }, columns: [{ blocks: [{ props: { color: 'var(--sh-text)', text: 'Hi' } }] }] }]
    const copy = JSON.stringify(tree)
    const { tree: mapped, mapped: count } = mapTemplateTokens(tree, { siteColourIds: site })
    expect(count).toBe(2)
    expect(JSON.stringify(mapped)).toContain('"var(--eg-c-background)"')
    expect(JSON.stringify(tree)).toBe(copy)
  })
})
