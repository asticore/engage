import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PdfViewerElement, QrCodeElement } from '@/components/blocks/elements/UtilityElements'
import { getElementDef } from '@/lib/elements/registry'

const html = (C: React.FC<Record<string, unknown>>, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(C, props))

describe('34g utility elements', () => {
  it('are in the library', () => {
    expect(getElementDef('qr-code')).toBeTruthy()
    expect(getElementDef('pdf-viewer')).toBeTruthy()
  })
  it('draws a QR code locally and escapes the label', () => {
    const out = html(QrCodeElement, { data: 'https://example.com/menu', size: 150, caption: 'Scan me', label: 'Menu <b>' })
    expect(out).toContain('<svg')
    expect(out).toContain('Scan me')
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('https://example.com')
  })
  it('asks for data when empty', () => {
    expect(html(QrCodeElement, { data: '' })).toContain('Add an address')
  })
  it('shows a PDF in a lazy frame with a download link, and refuses unsafe addresses', () => {
    const out = html(PdfViewerElement, { url: 'https://x.test/a.pdf', title: 'Menu' })
    expect(out).toContain('loading="lazy"')
    expect(out).toContain('Download Menu (PDF)')
    expect(html(PdfViewerElement, { url: 'javascript:alert(1)' })).not.toContain('javascript:')
    expect(html(PdfViewerElement, {})).toContain('Choose a PDF')
  })
})

import { parseFabItems } from '@/components/blocks/elements/UtilityElements'
describe('34g2 floating action button', () => {
  it('keeps safe items only', () => {
    expect(parseFabItems('Call | tel:+123\nTop | #top\nBad | javascript:alert(1)\nSite | https://example.com/x').map((i) => i.label)).toEqual(['Call', 'Top', 'Site'])
  })
})
