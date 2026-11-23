import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockStyleCss, type BlockStyle } from '@/lib/blockStyle'

describe('hover gradient', () => {
  it('writes a linear gradient into the hover rule', () => {
    const out = blockStyleCss({ hoverGradFrom: '#111111', hoverGradTo: '#eeeeee', hoverGradAngle: 90 } as BlockStyle, 'x1')
    expect(out).toContain('background-image:linear-gradient(90deg, #111111, #eeeeee) !important')
  })
  it('defaults the angle to 180 and fills a missing colour with transparent', () => {
    const out = blockStyleCss({ hoverGradFrom: '#111111' } as BlockStyle, 'x1')
    expect(out).toContain('linear-gradient(180deg, #111111, transparent)')
  })
  it('drops unsafe colours and clamps the angle', () => {
    const s = asBlockStyle({ hoverGradFrom: 'red;}', hoverGradAngle: 999 })
    expect(s.hoverGradFrom).toBeUndefined()
    expect(s.hoverGradAngle).toBe(360)
  })
})
