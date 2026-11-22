import { describe, expect, it } from 'vitest'
import { containerTag, parseSectionLayout, PUBLIC_SECTION_CSS_OPTIONS, safeHref, sectionLayoutCss, sectionLayoutProps } from '@/lib/sectionLayout'
import { blockStyleToCss, deviceOverrideDecls, sanitizeDeviceOverride } from '@/lib/blockStyle'

const css = sectionLayoutCss(PUBLIC_SECTION_CSS_OPTIONS)

describe('container layout (Task 13 / 32a)', () => {
  it('row and column gaps are separate per-device values', () => {
    const p = sectionLayoutProps({ rowGap: { desktop: 8, mobile: 2 }, columnGap: { desktop: 40 }, gapUnit: 'rem' })
    expect(p.style['--be-rg-d']).toBe('8rem')
    expect(p.style['--be-rg-m']).toBe('2rem')
    expect(p.style['--be-cg-d']).toBe('40rem')
    expect(css).toContain('row-gap:var(--be-rg,var(--be-gap))')
    expect(css).toContain('--be-rg:var(--be-rg-m,var(--be-rg-t,var(--be-rg-d)))')
  })

  it('width, max width and boxed width keep their unit per device', () => {
    const p = sectionLayoutProps({ contentWidth: 'boxed', boxed: { desktop: { v: 80, u: 'vw' }, tablet: { v: 90, u: '%' } }, width: { desktop: { v: 50, u: '%' } }, maxWidth: { mobile: { v: 20, u: 'rem' } } })
    expect(p.style['--be-bx-d']).toBe('80vw')
    expect(p.style['--be-bx-t']).toBe('90%')
    expect(p.style['--be-w-d']).toBe('50%')
    expect(p.style['--be-mw-m']).toBe('20rem')
    expect(p.attrs['data-w']).toBe('1')
    expect(p.attrs['data-bx']).toBe('1')
    expect(css).toContain('[data-w]{width:var(--be-w,auto)}')
  })

  it('legacy boxedWidth still writes --be-boxed', () => {
    expect(sectionLayoutProps({ contentWidth: 'boxed', boxedWidth: 900 }).style['--be-boxed']).toBe('900px')
  })

  it('accepts only the six units and rejects junk', () => {
    expect(parseSectionLayout({ width: { desktop: { v: 10, u: 'pt' } } })).toBeUndefined()
    for (const u of ['px', '%', 'em', 'rem', 'vw', 'vh']) expect(parseSectionLayout({ width: { desktop: { v: 10, u } } })?.width?.desktop?.u).toBe(u)
  })

  it('overflow and align-content are per device', () => {
    const p = sectionLayoutProps({ overflow: { desktop: 'hidden', mobile: 'auto' }, alignContent: { tablet: 'between' } })
    expect(p.attrs['data-ov-d']).toBe('hidden')
    expect(p.attrs['data-ov-m']).toBe('auto')
    expect(p.attrs['data-ac-t']).toBe('between')
    expect(css).toContain('[data-ov-m="scroll"]{overflow:scroll}')
    expect(css).toContain('[data-ac-t="between"]{align-content:space-between !important}')
  })

  it('baseline align items and wrap-reverse', () => {
    expect(sectionLayoutProps({ alignItems: 'baseline' }).style.alignItems).toBe('baseline')
    expect(css).toContain('[data-ai-t="baseline"]{align-items:baseline !important}')
    expect(sectionLayoutProps({ wrapReverse: true }).attrs['data-wrap-rev']).toBe('1')
    expect(sectionLayoutProps({ tablet: { wrapReverse: true } }).attrs['data-wrap-t']).toBe('r')
    expect(css).toContain('[data-wrap-t="r"]{flex-wrap:wrap-reverse}')
  })

  it('container tag: allowed list, link needs a safe address', () => {
    expect(containerTag({ tag: 'header' }).tag).toBe('header')
    expect(containerTag({ tag: 'script' }).tag).toBe('div')
    expect(containerTag({ tag: 'a' }).tag).toBe('div')
    expect(containerTag({ tag: 'a', href: 'javascript:alert(1)' }).tag).toBe('div')
    expect(containerTag({ tag: 'a', href: '/shop' })).toEqual({ tag: 'a', href: '/shop' })
    expect(safeHref('//evil.example')).toBeUndefined()
  })

  it('order works on blocks, per device', () => {
    expect(blockStyleToCss({ order: 2 }).order).toBe(2)
    expect(sanitizeDeviceOverride({ order: 99 })?.order).toBe(20)
    expect(deviceOverrideDecls({ tablet: { order: -1 } }, 'tablet')).toContain('order:-1 !important')
  })
})
