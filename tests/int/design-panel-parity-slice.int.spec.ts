import { describe, expect, it } from 'vitest'
import { asBlockStyle, blockFxClasses, blockFxVars, blockStyleCss, blockStyleToCss, deviceOverrideDecls, type BlockStyle } from '@/lib/blockStyle'

describe('design panel parity slice (Task 12, 31e)', () => {
  it('three shadow layers join with commas in order', () => {
    const css = blockStyleToCss({ bsY: 1, bsColor: '#000000', bs2Y: 2, bs2Color: '#111111', bs3Y: 3, bs3Inset: true, bs3Color: '#222222' })
    expect(css.boxShadow).toBe('0px 1px 12px 0px #000000, 0px 2px 12px 0px #111111, inset 0px 3px 12px 0px #222222')
  })
  it('the third layer is range checked', () => {
    const s = asBlockStyle({ bs3Blur: 9999, bs3Color: 'red;}' } as BlockStyle)
    expect(s.bs3Blur).toBe(300)
    expect(s.bs3Color).toBeUndefined()
  })
  it('hover text shadow goes into the hover rule only', () => {
    const style = { hoverTextShadowX: 1, hoverTextShadowY: 3, hoverTextShadowBlur: 5, hoverTextShadowColor: '#ff0000' } as BlockStyle
    expect(blockStyleCss(style, 'x1')).toContain('text-shadow:1px 3px 5px #ff0000 !important')
    expect(blockStyleToCss(style).textShadow).toBeUndefined()
    const bad = asBlockStyle({ hoverTextShadowColor: 'url(x)', hoverTextShadowBlur: 5000 } as BlockStyle)
    expect(bad.hoverTextShadowColor).toBeUndefined()
    expect(bad.hoverTextShadowBlur).toBe(200)
  })
  it('border colour and style are per device', () => {
    const style = asBlockStyle({ borderWidth: 2, borderColor: '#111111', tablet: { borderColor: '#222222', borderStyle: 'dashed' }, mobile: { borderColor: 'nope;' } } as BlockStyle)
    const tablet = deviceOverrideDecls(style, 'tablet')
    expect(tablet).toContain('border-color:#222222 !important')
    expect(tablet).toContain('border-style:dashed !important')
    expect(style.mobile?.borderColor).toBeUndefined()
  })
  it('a device border colour writes nothing when the border width is 0', () => {
    const style = asBlockStyle({ tablet: { borderColor: '#222222' } } as BlockStyle)
    expect(deviceOverrideDecls(style, 'tablet').join(';')).not.toContain('border-color')
  })
  it('static position is kept and writes position:static', () => {
    expect(blockStyleToCss(asBlockStyle({ position: 'static' } as BlockStyle)).position).toBe('static')
    expect(deviceOverrideDecls(asBlockStyle({ tablet: { position: 'static' } } as BlockStyle), 'tablet')).toContain('position:static !important')
  })
})

describe('per device background image (31e)', () => {
  it('a tablet image is written in the tablet rule and unsafe urls are dropped', () => {
    const style = asBlockStyle({ bgType: 'image', bgImageUrl: '/media/a.jpg', tablet: { bgImageUrl: '/media/b.jpg' }, mobile: { bgImageUrl: 'javascript:alert(1)' } } as BlockStyle)
    expect(deviceOverrideDecls(style, 'tablet')).toContain('background-image:url(/media/b.jpg) !important')
    expect(style.mobile?.bgImageUrl).toBeUndefined()
  })
})

describe('scrolling effects (31e)', () => {
  it('sets the class and variables, and nothing when unset', () => {
    const s = { scrollY: 80, scrollRotate: -10, scrollScale: 80, scrollOpacity: 40, scrollBlur: 6, scrollStart: 10, scrollEnd: 60 } as BlockStyle
    expect(blockFxClasses(s)).toContain('be-fx-scroll')
    const v = blockFxVars(s)
    expect(v['--be-sc-y']).toBe('80px')
    expect(v['--be-sc-r']).toBe('-10deg')
    expect(v['--be-sc-z']).toBe('0.8')
    expect(v['--be-sc-o']).toBe('0.4')
    expect(v['--be-sc-b']).toBe('6px')
    expect(v['--be-sc-s']).toBe('10%')
    expect(v['--be-sc-e']).toBe('60%')
    expect(blockFxClasses({})).not.toContain('be-fx-scroll')
  })
  it('values are clamped on read', () => {
    const s = asBlockStyle({ scrollY: 9999, scrollScale: 1, scrollEnd: 500 } as BlockStyle)
    expect(s.scrollY).toBe(400)
    expect(s.scrollScale).toBe(20)
    expect(s.scrollEnd).toBe(100)
  })
  it('off per device: tablet off is inherited by mobile unless mobile switches it on', () => {
    const css = blockStyleCss(asBlockStyle({ scrollY: 50, tablet: { scrollOff: 1 } } as BlockStyle), 'x1')
    expect(css).toContain('@media (min-width:601px) and (max-width:900px){#x1>.be-block__content{animation:none !important}}')
    expect(css).toContain('.be-block__content{animation:none !important}')
    expect(css).toContain('@media (max-width:600px){#x1>.be-block__content{animation:none !important}}')
    const back = blockStyleCss(asBlockStyle({ scrollY: 50, tablet: { scrollOff: 1 }, mobile: { scrollOff: 0 } } as BlockStyle), 'x1')
    expect(back).not.toContain('@media (max-width:600px){#x1>.be-block__content')
  })
  it('entrance animation off per device', () => {
    const css = blockStyleCss(asBlockStyle({ reveal: 'fade', mobile: { revealOff: 1 } } as BlockStyle), 'x1')
    expect(css).toContain('animation:none !important')
  })
})

describe('gradient stops and hover image (31e)', () => {
  const g: BlockStyle = { bgType: 'gradient', bgGradientFrom: '#111111', bgGradientTo: '#eeeeee', bgGradientAngle: 90 }
  it('extra stops are sorted by position', () => {
    const css = blockStyleToCss({ ...g, bgGradientMid: '#ff0000', bgGradientMidPos: 60, bgGradientMid2: '#00ff00', bgGradientMid2Pos: 30, bgGradientMid3: '#0000ff' })
    expect(css.backgroundImage).toBe('linear-gradient(90deg, #111111, #00ff00 30%, #ff0000 60%, #0000ff 90%, #eeeeee)')
  })
  it('hover image fades in over the transition time and unsafe urls are dropped', () => {
    const out = blockStyleCss(asBlockStyle({ hoverBgImageUrl: '/media/h.jpg', hoverTransitionMs: 400 } as BlockStyle), 'x1')
    expect(out).toContain('url(/media/h.jpg)')
    expect(out).toContain('opacity 400ms')
    expect(out).toContain(':hover::before{opacity:1}')
    expect(asBlockStyle({ hoverBgImageUrl: 'javascript:alert(1)' } as BlockStyle).hoverBgImageUrl).toBeUndefined()
  })
})
