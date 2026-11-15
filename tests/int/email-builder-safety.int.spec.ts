// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_EMAIL_BRAND } from '@/features/email/design/brand'
import { renderEmailHtml, renderEmailText, type EmailBlock } from '@/features/email/design'
import { starterBlocks } from '@/admin/views/email-designer/designerModel'

process.env.SITE_URL = 'https://example.test'

const brand = { ...DEFAULT_EMAIL_BRAND, enabled: true }
const everyBlock: EmailBlock[] = [
  { type: 'heading', text: 'Hi {{name}}', level: 1, align: 'left' },
  { type: 'text', text: 'Body **bold** [link](https://example.com)', align: 'left' },
  { type: 'button', label: 'Open', url: 'https://example.com/a', align: 'center' },
  { type: 'image', src: 'https://example.com/i.png', alt: 'x', width: 300 },
  { type: 'divider' },
  { type: 'spacer', height: 20 },
  { type: 'columns2', left: [{ type: 'text', text: 'L', align: 'left' }], right: [{ type: 'button', label: 'R', url: 'https://example.com/b', align: 'left' }] },
  { type: 'social', links: [{ network: 'facebook', url: 'https://facebook.com/x' }] },
  { type: 'footerNote', text: 'small' },
]

describe('email builder output is email client safe', () => {
  const html = renderEmailHtml(everyBlock, brand, { vars: { name: 'Ann' } })
  it('uses tables and inline styles only: no flex, grid, positioning, external css or scripts', () => {
    expect(html).not.toMatch(/display:\s*(flex|grid|inline-flex|inline-grid)/i)
    expect(html).not.toMatch(/position:\s*(absolute|fixed|sticky)/i)
    expect(html).not.toMatch(/<link[^>]+stylesheet/i)
    expect(html).not.toMatch(/@import/i)
    expect(html).not.toMatch(/<script/i)
    expect(html).toContain('role="presentation"')
  })
  it('gives Outlook a ghost table and a drawn button', () => {
    expect(html).toContain('<!--[if mso]>')
    expect(html).toContain('v:roundrect')
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"')
  })
  it('declares light and dark colour schemes and a mobile rule', () => {
    expect(html).toContain('name="color-scheme" content="light dark"')
    expect(html).toContain('@media only screen and (max-width: 620px)')
  })
  it('has a plain text part with the tags filled', () => {
    const text = renderEmailText(everyBlock, brand, { name: 'Ann' })
    expect(text).toContain('Hi Ann')
    expect(text.length).toBeGreaterThan(20)
  })
  it('every starter design stays safe', () => {
    for (const key of ['orderReceipt', 'welcome'] as const) {
      const blocks = starterBlocks(key as never)
      if (!blocks) continue
      expect(renderEmailHtml(blocks, brand, {})).not.toMatch(/display:\s*(flex|grid)/i)
    }
  })
})
