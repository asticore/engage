import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TimelineElement } from '@/components/blocks/elements/Wave36Elements'
import { getElementDef } from '@/lib/elements/registry'

const html = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(TimelineElement, props))

describe('timeline element (34a)', () => {
  it('is visible in the library', () => {
    expect(getElementDef('timeline')?.hidden).toBeFalsy()
  })

  it('renders layout, groups, icon, image, link and reveal', () => {
    const out = html({
      layout: 'alternating', reveal: 'fade-up',
      items: [
        { date: '2020', group: 'Y1', title: 'A', icon: 'star', image: 'https://x.test/a.jpg', alt: 'pic', url: 'https://x.test', linkLabel: 'Go', color: '#ff0000' },
        { date: '2021', group: 'Y1', title: 'B' },
      ],
    })
    expect(out).toContain('be-el-timeline--alternating')
    expect(out.match(/be-el-timeline__group/g)).toHaveLength(1)
    expect(out).toContain('data-spark-reveal="fade-up"')
    expect(out).toContain('alt="pic"')
    expect(out).toContain('>Go<')
    expect(out).toContain('--tl-dot:#ff0000')
  })

  it('adds Event JSON-LD only when asked and only for ISO dates', () => {
    const items = [{ date: '2020-05', title: 'A' }, { date: 'Soon', title: 'B' }]
    expect(html({ items })).not.toContain('ld+json')
    const out = html({ items, schema: true })
    expect(out).toContain('"@type":"Event"')
    expect(out).not.toContain('"name":"B"')
  })

  it('refuses unsafe link and image schemes', () => {
    const out = html({ items: [{ title: 'A', url: 'javascript:alert(1)', image: 'javascript:alert(1)' }] })
    expect(out).not.toContain('javascript:')
  })
})
