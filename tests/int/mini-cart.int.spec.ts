import { describe, expect, it } from 'vitest'

import { isCartHref, normaliseCartUi } from '@/features/ecommerce/lib/miniCart'

describe('mini cart settings', () => {
  it('defaults to the cart page and opens on add', () => {
    expect(normaliseCartUi(null)).toEqual({ action: 'page', openOnAdd: true })
    expect(normaliseCartUi({ cartAction: 'nonsense' })).toEqual({ action: 'page', openOnAdd: true })
  })
  it('reads drawer, dropdown and the open on add switch', () => {
    expect(normaliseCartUi({ cartAction: 'drawer', cartOpenOnAdd: false })).toEqual({ action: 'drawer', openOnAdd: false })
    expect(normaliseCartUi({ cartAction: 'dropdown' }).action).toBe('dropdown')
  })
})

describe('isCartHref', () => {
  it('matches the cart page and locale prefixed cart pages', () => {
    for (const h of ['/cart', '/cart/', '/fr/cart', '/pt-BR/cart', '/cart?x=1']) expect(isCartHref(h)).toBe(true)
  })
  it('does not match other links', () => {
    for (const h of ['/checkout', '/cartoons', '/shop/cart', null, '']) expect(isCartHref(h)).toBe(false)
  })
})
