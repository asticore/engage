import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GalleryElement } from '@/components/blocks/elements/Wave49Elements'

const render = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(GalleryElement, p))
const base = { layout: 'grid', lightbox: false, urls: 'https://x.test/a.jpg | A\nhttps://x.test/b.jpg | B\nhttps://x.test/c.jpg | C', categories: 'Cats\nDogs\nCats' }

describe('gallery category filter', () => {
  it('tags every picture with its category and wraps the list when on', () => {
    const html = render({ ...base, filter: true })
    expect(html).toContain('be-el-49-filter')
    expect((html.match(/data-cat="Cats"/g) ?? []).length).toBe(2)
    expect(html).toContain('data-cat="Dogs"')
  })
  it('shows chips only after load, so server markup has none', () => {
    expect(render({ ...base, filter: true })).not.toContain('be-el-49-filter__chip')
  })
  it('is off by default and for carousels', () => {
    expect(render(base)).not.toContain('data-cat')
    expect(render({ ...base, filter: true, layout: 'carousel' })).not.toContain('be-el-49-filter')
  })
})
