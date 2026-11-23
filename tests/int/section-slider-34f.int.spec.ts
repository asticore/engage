import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SectionBlock } from '@/components/blocks/SectionBlock'
import { carouselStyle, parseSectionLayout } from '@/lib/sectionLayout'

const layout = { display: 'carousel', carouselPerView: 3, carouselPerViewTablet: 2, carouselPerViewMobile: 1, carouselDots: true, carouselLoop: true, carouselAutoplay: 5, carouselArrows: true }
const columns = [1, 2, 3, 4].map((n) => ({ width: 12, blocks: [{ blockType: 'element', elementType: 'heading', props: { text: `S${n}`, tag: 'h3' } }] }))
const html = (lay: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(SectionBlock, { columns, design: { layout: lay }, renderNode: ((n: { props?: { text?: string } }, k: string) => React.createElement('p', { key: k }, n.props?.text)) as never }))

describe('section slider options (34f)', () => {
  it('keeps valid options and drops invalid ones', () => {
    const p = parseSectionLayout({ ...layout, carouselAutoplay: 99, carouselPerViewMobile: 9 })!
    expect(p.carouselDots).toBe(true)
    expect(p.carouselLoop).toBe(true)
    expect(p.carouselAutoplay).toBeUndefined()
    expect(p.carouselPerViewMobile).toBeUndefined()
    expect(p.carouselPerViewTablet).toBe(2)
  })
  it('writes per device custom properties', () => {
    const s = carouselStyle(layout)
    expect(s['--be-carousel-per-t']).toBe('2')
    expect(s['--be-carousel-per-m']).toBe('1')
    expect(carouselStyle({ display: 'carousel' })['--be-carousel-per-t']).toBeUndefined()
  })
  it('renders dots, looping arrows and no dots when off', () => {
    const on = html(layout)
    expect(on).toContain('be-carousel__dots')
    expect(on.match(/be-carousel__dot"/g)!.length).toBe(Math.ceil(4 / 3))
    expect(on).toContain('Previous slide, 4 of 4')
    const off = html({ display: 'carousel', carouselArrows: true })
    expect(off).not.toContain('be-carousel__dots')
    expect(off).not.toContain('Previous slide, 4 of 4')
  })
})
