import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ShapeDivider } from '@/components/blocks/StyledBlock'
import { asBlockStyle } from '@/lib/blockStyle'

const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(ShapeDivider, { shape: 'wave', position: 'bottom', ...props } as never))

describe('shape divider width, invert and front', () => {
  it('defaults add nothing', () => {
    const h = html({})
    expect(h).not.toContain('scaleY')
    expect(h).not.toContain('z-index')
  })
  it('width is centred, invert mirrors, front lifts', () => {
    const h = html({ width: 200, invert: true, front: true })
    expect(h).toContain('width:200%')
    expect(h).toContain('left:-50%')
    expect(h).toContain('scaleY(-1)')
    expect(h).toContain('z-index:20')
  })
  it('width is clamped on save', () => {
    expect(asBlockStyle({ dividerTopWidth: 9000 }).dividerTopWidth).toBe(400)
    expect(asBlockStyle({ dividerBottomWidth: 10 }).dividerBottomWidth).toBe(100)
  })
})
