import { describe, expect, it } from 'vitest'

import { safeAccountNext } from '@/components/blocks/elements/Wave71Elements'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

describe('wave71 account form elements', () => {
  it('registers the forms as client elements', () => {
    for (const t of ['login-form', 'registration-form', 'password-reset-form']) {
      expect(getElementDef(t)).toBeTruthy()
      expect(SITE_ELEMENT_TYPES.has(t)).toBe(false)
    }
  })
  it('only follows paths inside the account area', () => {
    expect(safeAccountNext('/account/orders')).toBe('/account/orders')
    expect(safeAccountNext('')).toBe('/account')
    expect(safeAccountNext('//evil.com')).toBe('/account')
    expect(safeAccountNext('https://evil.com')).toBe('/account')
    expect(safeAccountNext('/account/x y')).toBe('/account')
  })
})
