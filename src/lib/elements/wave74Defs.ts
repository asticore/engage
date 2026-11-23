import type { ElementDef } from './registry'

/**
 * Wave 74 (Task 10, 29d): the cart page body, the checkout page body and the mini cart trigger. They embed the
 * existing client pieces (CartPageClient, CheckoutForm, MiniCart's cart link). No payment or cart code lives here.
 * Renderer: Wave74Elements.tsx. Icons are String.fromCodePoint escapes.
 */

export const WAVE74_ELEMENTS: ElementDef[] = [
  {
    type: 'cart-contents', label: 'Cart contents', icon: String.fromCodePoint(0x1f6d2), category: 'commerce',
    description: 'The cart page body: the lines, extras, totals and the checkout summary. It opens the same way as the built-in cart page.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'checkout-form', label: 'Checkout form', icon: String.fromCodePoint(0x1f9fe), category: 'commerce',
    description: 'The checkout page body: the currency note and the checkout form, using the shop normal payment methods.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'mini-cart', label: 'Mini cart', icon: String.fromCodePoint(0x1f6cd), category: 'commerce',
    description: 'A cart button that opens the cart drawer or dropdown (Shop settings). With the page option it opens the cart page.',
    fields: [
      { name: 'label', label: 'Button label', type: 'text' },
      { name: 'showCount', label: 'Show the number of items', type: 'checkbox' },
    ],
    defaultProps: () => ({ label: 'Cart', showCount: true }),
  },
]
