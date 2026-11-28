import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BeforeAfterElement, PopupElement } from '@/components/blocks/elements/Wave64Elements'
import { getElementDef } from '@/lib/elements/registry'

const html = (C: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C, props))

describe('before-after element (spark-compare)', () => {
  it('renders two images in a spark-compare box with options as data attributes', () => {
    const out = html(BeforeAfterElement, { beforeUrl: 'https://x.test/a.jpg', afterUrl: 'https://x.test/b.jpg', start: 30, vertical: true, hover: true })
    expect(out).toContain('spark-compare')
    expect(out).toContain('data-spark-start="30"')
    expect(out).toContain('data-spark-vertical="true"')
    expect(out.match(/<img /g)?.length).toBe(2)
  })
  it('asks for both pictures', () => {
    expect(html(BeforeAfterElement, { beforeUrl: 'https://x.test/a.jpg' })).toContain('el-placeholder')
  })
  it('is registered', () => {
    expect(getElementDef('before-after')).toBeTruthy()
    expect(getElementDef('popup')).toBeTruthy()
  })
})

describe('popup element (spark-popup on a Shine modal)', () => {
  it('opens from a button and carries trigger options', () => {
    const out = html(PopupElement, { buttonLabel: 'Open', title: 'Hi', body: 'One\n\nTwo', delay: 5, scroll: 40, exit: true, frequency: 'days', days: 3 })
    expect(out).toContain('class="modal spark-popup"')
    expect(out).toMatch(/data-spark-open="eg-popup-/)
    expect(out).toContain('data-spark-delay="5"')
    expect(out).toContain('data-spark-scroll="40"')
    expect(out).toContain('data-spark-exit="true"')
    expect(out).toContain('data-spark-days="3"')
    expect(out).toContain('<p>One</p><p>Two</p>')
  })
  it('escapes text and drops unsafe links', () => {
    const out = html(PopupElement, { buttonLabel: 'x', title: '<script>', ctaLabel: 'Go', ctaUrl: 'javascript:alert(1)' })
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('javascript:')
  })
})
