import { describe, expect, it } from 'vitest'

import { asBlockStyle, blockStyleToCss, type BlockStyle } from '@/lib/blockStyle'

describe('image placement and overline (31e)', () => {
  const base: BlockStyle = { bgType: 'image', bgImageUrl: 'https://x.test/a.jpg' }
  it('defaults stay cover and centre', () => {
    const css = blockStyleToCss(base)
    expect(css.backgroundSize).toBe('cover')
    expect(css.backgroundPosition).toBe('center')
    expect(css.backgroundRepeat).toBeUndefined()
  })
  it('size, position, repeat and fixed attachment are written', () => {
    const css = blockStyleToCss({ ...base, bgImageSize: 'contain', bgImagePosition: 'top left', bgImageRepeat: 'repeat-x', bgImageAttachment: 'fixed' })
    expect([css.backgroundSize, css.backgroundPosition, css.backgroundRepeat, css.backgroundAttachment]).toEqual(['contain', 'top left', 'repeat-x', 'fixed'])
  })
  it('bad values are dropped on read', () => {
    const clean = asBlockStyle({ ...base, bgImageSize: 'stretch', bgImageRepeat: 'x', bgImageAttachment: 'local' } as unknown as BlockStyle)
    expect(clean.bgImageSize).toBeUndefined()
    expect(clean.bgImageRepeat).toBeUndefined()
    expect(clean.bgImageAttachment).toBeUndefined()
  })
  it('overline is a valid decoration', () => {
    expect(blockStyleToCss({ textDecoration: 'overline' }).textDecoration).toBe('overline')
    expect(asBlockStyle({ textDecoration: 'blink' } as unknown as BlockStyle).textDecoration).toBeUndefined()
  })
})
