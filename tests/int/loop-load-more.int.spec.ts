import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LoopView, loopSettings } from '@/components/blocks/elements/Wave50Elements'

const items = [{ id: '1', title: 'One', url: '/a', image: '', excerpt: '', price: '', date: '' }]
const html = (p: Record<string, unknown>, totalPages = 3) =>
  renderToStaticMarkup(React.createElement(LoopView, { settings: loopSettings({ loadMore: true, ...p }), items, totalPages }))

describe('loop load more', () => {
  it('defaults to the plain next page link', () => {
    expect(html({})).toContain('>Next page<')
  })
  it('button mode keeps a real link with the label', () => {
    const out = html({ loadMoreMode: 'button', loadMoreLabel: 'Show more' })
    expect(out).toContain('href="?page=2"')
    expect(out).toContain('>Show more<')
  })
  it('no link on the last page, bad mode falls back', () => {
    expect(html({ loadMoreMode: 'button', page: 3 })).not.toContain('be-el-50-loop__next')
    expect(loopSettings({ loadMoreMode: 'nope' }).loadMoreMode).toBe('link')
  })
})
