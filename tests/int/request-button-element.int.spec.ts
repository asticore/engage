import { describe, expect, it } from 'vitest'

import { REQUEST_BUTTON_COMPONENTS, requestHref } from '@/components/blocks/elements/RequestButtonServer'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'

describe('request button element (12c)', () => {
  it('is registered as a server element with defaults', () => {
    expect(getElementDef('request-button')?.defaultProps()).toMatchObject({ kind: 'quote', variant: 'primary' })
    expect(SITE_ELEMENT_TYPES.has('request-button')).toBe(true)
    expect(REQUEST_BUTTON_COMPONENTS['request-button']).toBeTypeOf('function')
  })
  it('links to the request page with the page product', () => {
    expect(requestHref({ kind: 'bid' }, { id: 5, title: 'Oak table' })).toEqual({ href: '/request-quote?kind=bid&product=5&title=Oak+table', text: 'Make an offer' })
  })
  it('prefers a chosen product and custom text, and cleans bad input', () => {
    expect(requestHref({ kind: 'item', productId: 9, text: ' Ask us ' }, { id: 5, title: 'Oak table' })).toEqual({ href: '/request-quote?kind=item&product=9', text: 'Ask us' })
    expect(requestHref({ kind: 'nope', productId: -3 })).toEqual({ href: '/request-quote?kind=quote', text: 'Request a quote' })
  })
})
