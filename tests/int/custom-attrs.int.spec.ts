import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { StyledBlock } from '@/components/blocks/StyledBlock'
import { asBlockStyle, sanitizeCustomAttrs } from '@/lib/blockStyle'
import { readFlatDesign } from '@/lib/design/upgrade'
import { toStoredDesign } from '@/lib/design/storeDesign'

const names = (t: string) => sanitizeCustomAttrs(t).map((a) => a.name)

describe('sanitizeCustomAttrs', () => {
  it('accepts the allowed names', () => {
    expect(sanitizeCustomAttrs('aria-label|Open menu\ndata-track|cta\nrole|Button\ntitle|Hi\ntabindex|-1\nlang|fr-CA\nrel|nofollow ugc')).toEqual([
      { name: 'aria-label', value: 'Open menu' },
      { name: 'data-track', value: 'cta' },
      { name: 'role', value: 'button' },
      { name: 'title', value: 'Hi' },
      { name: 'tabindex', value: '-1' },
      { name: 'lang', value: 'fr-CA' },
      { name: 'rel', value: 'nofollow ugc' },
    ])
  })
  it('rejects dangerous or unlisted names', () => {
    for (const bad of ['onclick|x', 'onmouseover|x', 'style|color:red', 'class|a', 'id|a', 'href|javascript:x', 'src|x', 'srcdoc|<p>', 'formaction|x', 'target|_blank', 'name|x', 'Bad Name|x', '1abc|x', 'x'.repeat(41) + '|v', 'data-|x', 'aria-|x']) {
      expect(names(bad), bad).toEqual([])
    }
  })
  it('protects attributes the page scripts own', () => {
    expect(names('data-eg-cond|{}\ndata-eg-ok|\ndata-eg-off|\ndata-be-gallery-index|1')).toEqual([])
  })
  it('validates values', () => {
    expect(names('tabindex|5')).toEqual([])
    expect(names('tabindex|0')).toEqual(['tabindex'])
    expect(names('role|script')).toEqual([])
    expect(names('rel|noopener evil')).toEqual([])
    expect(names('lang|<x>')).toEqual([])
    expect(names('aria-label|')).toEqual([])
    expect(sanitizeCustomAttrs('data-flag')).toEqual([{ name: 'data-flag', value: '' }])
  })
  it('strips control characters, caps value length, line count and duplicates', () => {
    expect(sanitizeCustomAttrs('data-a|x\u0000y\u0007z')[0].value).toBe('xyz')
    expect(sanitizeCustomAttrs('data-a|' + 'v'.repeat(500))[0].value).toHaveLength(200)
    const many = Array.from({ length: 30 }, (_, i) => `data-k${i}|v`).join('\n')
    expect(sanitizeCustomAttrs(many)).toHaveLength(10)
    expect(sanitizeCustomAttrs('data-a|1\ndata-a|2')).toEqual([{ name: 'data-a', value: '1' }])
    expect(sanitizeCustomAttrs(42)).toEqual([])
  })
  it('keeps a pipe inside the value', () => {
    expect(sanitizeCustomAttrs('data-x|a|b')).toEqual([{ name: 'data-x', value: 'a|b' }])
  })
})

describe('customAttrs in the block style', () => {
  it('is cleaned by asBlockStyle and dropped when nothing survives', () => {
    expect(asBlockStyle({ customAttrs: 'onclick|x\naria-label|Menu' }).customAttrs).toBe('aria-label|Menu')
    expect(asBlockStyle({ customAttrs: 'onclick|x' }).customAttrs).toBeUndefined()
    expect(asBlockStyle({ customAttrs: 5 }).customAttrs).toBeUndefined()
  })
  it('round trips through the stored design', () => {
    const style = asBlockStyle({ customAttrs: 'aria-label|Menu\ndata-track|cta', paddingTop: 10 })
    expect(readFlatDesign(toStoredDesign(style)).customAttrs).toBe('aria-label|Menu\ndata-track|cta')
  })
  it('reaches the wrapper element, escaped, and cannot override script attributes', () => {
    const props = { style: { customAttrs: 'aria-label|a"b<c\ndata-eg-cond|{}\nonclick|x\nid|evil' }, index: 0, children: 'x' }
    const html = renderToStaticMarkup(createElement(StyledBlock, props))
    expect(html).toContain('aria-label="a&quot;b&lt;c"')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('data-eg-cond')
    expect(html).toContain('id="be-block-0"')
  })
})
