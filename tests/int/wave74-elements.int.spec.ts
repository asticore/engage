import { describe, expect, it } from 'vitest'

import { WAVE74_COMPONENTS } from '@/components/blocks/elements/Wave74Elements'
import { ELEMENT_COMPONENTS } from '@/components/blocks/elements/elementComponents'
import { getElementDef } from '@/lib/elements/registry'
import { WAVE74_ELEMENTS } from '@/lib/elements/wave74Defs'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

const TYPES = ['cart-contents', 'checkout-form', 'mini-cart']

describe('wave74 cart, checkout and mini cart elements', () => {
  it('registers the three elements in the commerce group', () => {
    expect(WAVE74_ELEMENTS.map((e) => e.type)).toEqual(TYPES)
    for (const type of TYPES) {
      expect(getElementDef(type)?.category).toBe('commerce')
    }
  })
  it('keeps them client elements, not server (SITE_ELEMENT_TYPES)', () => {
    for (const type of TYPES) expect(SITE_ELEMENT_TYPES.has(type)).toBe(false)
  })
  it('has a renderer for each type in the element component map', () => {
    for (const type of TYPES) {
      expect(WAVE74_COMPONENTS[type]).toBeTypeOf('function')
      expect(ELEMENT_COMPONENTS[type]).toBe(WAVE74_COMPONENTS[type])
    }
  })
  it('uses only declared fields in the default props', () => {
    for (const def of WAVE74_ELEMENTS) {
      const names = new Set(def.fields.map((f) => f.name))
      for (const key of Object.keys(def.defaultProps())) expect(names.has(key)).toBe(true)
    }
  })
})
