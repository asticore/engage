import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AlertElement } from '@/components/blocks/elements/InteractiveElements'

const h = (props: Record<string, unknown>) => createElement(AlertElement, props)

describe('alert dismiss and toast', () => {
  it('stays a plain notice by default', () => {
    const html = renderToStaticMarkup(h({ kind: "info", title: "Hi", text: "Body" }))
    expect(html).not.toContain('el-alert__close')
  })
  it('adds an accessible close button when dismissible', () => {
    const html = renderToStaticMarkup(h({ kind: "warning", title: "Hi", dismissible: true }))
    expect(html).toContain('el-alert__close')
    expect(html).toContain('aria-label="Dismiss"')
  })
  it('renders a toast with status role', () => {
    const html = renderToStaticMarkup(h({ kind: "success", title: "Saved", toast: true, autoClose: 5 }))
    expect(html).toContain('el-alert--toast')
    expect(html).toContain('role="status"')
  })
})
