import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockStyleCss, type BlockStyle } from '@/lib/blockStyle'

describe('hover blend mode and text stroke', () => {
  it('writes them into the hover rule', () => {
    const out = blockStyleCss({ hoverBlendMode: 'screen', hoverTextStrokeWidth: 2, hoverTextStrokeColor: '#ff0000' } as BlockStyle, 'x1')
    expect(out).toContain('mix-blend-mode:screen !important')
    expect(out).toContain('-webkit-text-stroke:2px #ff0000 !important')
  })
  it('drops unknown values', () => {
    const s = asBlockStyle({ hoverBlendMode: 'bogus' as never, hoverTextStrokeColor: 'red;}' })
    expect(s.hoverBlendMode).toBeUndefined()
    expect(s.hoverTextStrokeColor).toBeUndefined()
  })
})
