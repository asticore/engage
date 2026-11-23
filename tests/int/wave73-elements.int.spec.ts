import { describe, expect, it } from 'vitest'

import { accountTabs } from '@/components/blocks/elements/Wave73Elements'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

describe('wave73 my account element', () => {
  it('registers as a client element', () => {
    expect(getElementDef('my-account')).toBeTruthy()
    expect(SITE_ELEMENT_TYPES.has('my-account')).toBe(false)
  })
  it('shows every tab by default and hides the ones turned off', () => {
    expect(accountTabs({}).map((t) => t.label)).toEqual(['Orders', 'Addresses', 'Profile', 'Bookings'])
    expect(accountTabs({ showOrders: false, showBookings: false }).map((t) => t.href)).toEqual(['/account/addresses', '/account/profile'])
  })
})
