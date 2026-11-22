import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { VideoElement } from '@/components/blocks/elements/MediaElements'

const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(VideoElement, props))

describe('video popup option', () => {
  it('loads nothing until played: tile and closed dialog, no iframe', () => {
    const html = render({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Demo', popup: true })
    expect(html).toContain('el-video-popup__tile')
    expect(html).toContain('aria-label="Play video: Demo"')
    expect(html).not.toContain('<iframe')
  })
  it('is the normal inline video without the option', () => {
    const html = render({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Demo' })
    expect(html).toContain('<iframe')
    expect(html).not.toContain('el-video-popup')
  })
})
