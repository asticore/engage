import { describe, expect, it } from 'vitest'

import { shouldLoad, slidesSettings, stepIndex, textAnimationOf, videoSrc } from '@/lib/elements/slidesLogic'

describe('slides settings', () => {
  it('keeps the old look for slides saved before the new options', () => {
    expect(slidesSettings({ height: 420 })).toMatchObject({ loop: true, arrows: true, dots: true, thumbnails: false, height: 420, interval: 6 })
  })
  it('lets arrows and dots differ on phones, following the desktop choice until set', () => {
    expect(slidesSettings({ arrows: false })).toMatchObject({ arrows: false, arrowsMobile: false })
    expect(slidesSettings({ arrows: true, arrowsMobile: false, dots: false, dotsMobile: true })).toMatchObject({ arrows: true, arrowsMobile: false, dots: false, dotsMobile: true })
  })
  it('clamps heights and the interval', () => {
    expect(slidesSettings({ height: 5000, heightMobile: 10, interval: 1 })).toMatchObject({ height: 1000, heightMobile: 160, interval: 2 })
    expect(slidesSettings({ height: 'x' }).height).toBe(420)
  })
  it('accepts only http, https and site videos of the right type', () => {
    expect(videoSrc('/media/a.mp4')).toBe('/media/a.mp4')
    expect(videoSrc('https://x.test/a.webm?v=1')).toBe('https://x.test/a.webm?v=1')
    expect(videoSrc('//evil.test/a.mp4')).toBe('')
    expect(videoSrc('javascript:alert(1).mp4')).toBe('')
    expect(videoSrc('https://x.test/a.mov')).toBe('')
    expect(videoSrc('/a b.mp4')).toBe('')
  })
  it('stops at the ends without loop and wraps with it', () => {
    expect(stepIndex(0, 3, -1, false)).toBe(0)
    expect(stepIndex(2, 3, 1, false)).toBe(2)
    expect(stepIndex(0, 3, -1, true)).toBe(2)
  })
  it('loads the slide in view and its neighbours only', () => {
    expect(shouldLoad(0, 0, 10)).toBe(true)
    expect(shouldLoad(1, 0, 10)).toBe(true)
    expect(shouldLoad(9, 0, 10)).toBe(true)
    expect(shouldLoad(5, 0, 10)).toBe(false)
    expect(shouldLoad(2, 0, 3)).toBe(true)
  })
  it('falls back to fade up for an unknown text animation', () => {
    expect(textAnimationOf('zoom')).toBe('zoom')
    expect(textAnimationOf('spin')).toBe('fade-up')
  })
})
