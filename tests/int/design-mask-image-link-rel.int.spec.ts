// @vitest-environment node
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StyledBlock } from '@/components/blocks/StyledBlock'
import { asBlockStyle, blockStyleToCss, type BlockStyle } from '@/lib/blockStyle'

describe('image mask and link rel options (31e)', () => {
  it('writes the mask with defaults and with choices', () => {
    const css = blockStyleToCss({ maskImageUrl: '/media/blob.svg' })
    expect(css.maskImage).toBe('url(/media/blob.svg)')
    expect(css.maskSize).toBe('contain')
    expect(css.maskRepeat).toBe('no-repeat')
    const c2 = blockStyleToCss({ maskImageUrl: 'https://x.test/a.png', maskImageSize: 'cover', maskImagePosition: 'top', maskImageRepeat: 'repeat-x' })
    expect([c2.maskSize, c2.maskPosition, c2.maskRepeat]).toEqual(['cover', 'top', 'repeat-x'])
  })
  it('refuses an unsafe mask address', () => {
    for (const bad of ['javascript:alert(1)', '//evil.test/a.svg', 'https://x.test/a.svg")', 'data:image/svg+xml,x', 'https://x.test/a.exe']) {
      expect(asBlockStyle({ maskImageUrl: bad } as unknown as BlockStyle).maskImageUrl).toBeUndefined()
    }
  })
  it('the wrapper link carries sponsored and ugc in rel', () => {
    const html = renderToString(
      React.createElement(StyledBlock, { index: 0, style: { wrapLink: 'https://x.test/p', wrapLinkSponsored: true, wrapLinkUgc: true, wrapLinkNoFollow: true } as BlockStyle } as React.ComponentProps<typeof StyledBlock>, 'hi'),
    )
    expect(html).toContain('rel="nofollow sponsored ugc"')
  })
})
