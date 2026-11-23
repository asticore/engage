// @vitest-environment node
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { HeadingElement } from '@/components/blocks/elements/HeadingElement'
import { asBlockStyle, blockStyleCss, deviceOverrideDecls, type BlockStyle } from '@/lib/blockStyle'

describe('heading tag and per-device text styling (31e)', () => {
  it('renders the chosen tag, including p, div and span', () => {
    for (const tag of ['h1', 'p', 'div', 'span'] as const) {
      expect(renderToString(React.createElement(HeadingElement, { text: 'Hi', tag }))).toMatch(new RegExp(`^<${tag}[ >]`))
    }
  })
  it('an unknown tag falls back to h2 and an effect keeps a real heading', () => {
    expect(renderToString(React.createElement(HeadingElement, { text: 'Hi', tag: 'script' as unknown as 'h1' }))).toMatch(/^<h2[ >]/)
    expect(renderToString(React.createElement(HeadingElement, { text: 'Hi', tag: 'p', effect: 'split' }))).toContain('<h2')
  })
  it('transform, style and decoration can differ on tablet and mobile', () => {
    const style = asBlockStyle({ textTransform: 'uppercase', tablet: { fontStyle: 'italic' }, mobile: { textTransform: 'none', textDecoration: 'overline', fontStyle: 'bogus' } } as unknown as BlockStyle)
    expect(style.mobile?.fontStyle).toBeUndefined()
    expect(deviceOverrideDecls(style, 'tablet')).toContain('font-style:italic !important')
    const mobile = deviceOverrideDecls(style, 'mobile')
    expect(mobile).toContain('text-transform:none !important')
    expect(mobile).toContain('text-decoration:overline !important')
    expect(blockStyleCss(style, 'a1')).toContain('text-transform:none !important')
  })
})
