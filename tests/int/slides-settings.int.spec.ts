import { describe, expect, it } from 'vitest'

import { layersOf, shouldLoad, slidesSettings, swipeDirection, stepIndex, textAnimationOf, videoSrc } from '@/lib/elements/slidesLogic'

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

describe('slide layers and swipe', () => {
  it('keeps layers inside the slide and drops unknown kinds to text', () => {
    const [a, b] = layersOf([{ layerType: 'button', text: 'Go', url: '/x', x: 500, y: -4, width: 1, delay: 99, animation: 'zoom', sparkEffect: 'a b<c' }, { layerType: 'weird' }])
    expect(a).toMatchObject({ type: 'button', x: 100, y: 0, width: 5, delay: 10, animation: 'zoom', spark: 'abc' })
    expect(b.type).toBe('text')
    expect(layersOf('nope')).toEqual([])
    expect(layersOf(Array.from({ length: 20 }, () => ({}))).length).toBe(8)
  })
  it('moves on a long drag or a short quick flick, not a small slow one', () => {
    expect(swipeDirection(-120, 600)).toBe(1)
    expect(swipeDirection(120, 600)).toBe(-1)
    expect(swipeDirection(-30, 50)).toBe(1)
    expect(swipeDirection(-30, 400)).toBe(0)
    expect(swipeDirection(10, 10)).toBe(0)
  })
})
