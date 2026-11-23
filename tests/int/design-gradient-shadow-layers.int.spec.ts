import { describe, expect, it } from 'vitest'

import { asBlockStyle, blockStyleToCss, type BlockStyle } from '@/lib/blockStyle'

const g: BlockStyle = { bgType: 'gradient', bgGradientFrom: '#111111', bgGradientTo: '#eeeeee', bgGradientAngle: 90 }

describe('gradient kinds and shadow layers (31e)', () => {
  it('linear stays the default, radial and conic are written', () => {
    expect(blockStyleToCss(g).backgroundImage).toBe('linear-gradient(90deg, #111111, #eeeeee)')
    expect(blockStyleToCss({ ...g, bgGradientKind: 'radial' }).backgroundImage).toBe('radial-gradient(circle, #111111, #eeeeee)')
    expect(blockStyleToCss({ ...g, bgGradientKind: 'conic' }).backgroundImage).toBe('conic-gradient(from 90deg, #111111, #eeeeee)')
  })
  it('a middle stop sits at its position, default 50 percent', () => {
    expect(blockStyleToCss({ ...g, bgGradientMid: '#ff0000' }).backgroundImage).toBe('linear-gradient(90deg, #111111, #ff0000 50%, #eeeeee)')
    expect(blockStyleToCss({ ...g, bgGradientMid: '#ff0000', bgGradientMidPos: 25 }).backgroundImage).toContain('#ff0000 25%')
  })
  it('bad gradient values are dropped', () => {
    const clean = asBlockStyle({ ...g, bgGradientKind: 'spiral', bgGradientMid: 'url(x)', bgGradientMidPos: 500 } as unknown as BlockStyle)
    expect(clean.bgGradientKind).toBeUndefined()
    expect(clean.bgGradientMid).toBeUndefined()
    expect(clean.bgGradientMidPos).toBe(100)
  })
  it('two shadow layers join with a comma', () => {
    const css = blockStyleToCss({ bsY: 2, bsBlur: 4, bsColor: '#000000', bs2Y: 20, bs2Blur: 40, bs2Color: '#222222', bs2Inset: true })
    expect(css.boxShadow).toBe('0px 2px 4px 0px #000000, inset 0px 20px 40px 0px #222222')
  })
})
