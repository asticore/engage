import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Wave 66: shop widgets. They render on the server (SITE_ELEMENT_TYPES) so they can read the product from the block
 * context; the cart parts are client islands in Wave66Elements.tsx. Icons are String.fromCodePoint so this file is ASCII.
 * Lottie is intentionally absent: it needs a player dependency.
 */

const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', ...extra })

export const WAVE66_ELEMENTS: ElementDef[] = [
  {
    type: 'add-to-cart', label: 'Add to cart', icon: String.fromCodePoint(0x1f6d2), category: 'commerce',
    description: 'An add to cart button. On a product page it adds that product; elsewhere, enter a product ID.',
    fields: [
      text('label', 'Button label'),
      { name: 'productId', label: 'Product ID (optional)', type: 'number', width: 'half', helpText: 'Leave empty on a product page to use that product.' },
      { name: 'showQuantity', label: 'Show a quantity box', type: 'checkbox' },
    ],
    defaultProps: () => ({ label: 'Add to cart', productId: undefined, showQuantity: false }),
  },
  {
    type: 'cart-link', label: 'Cart link', icon: String.fromCodePoint(0x1f6d2), category: 'commerce',
    description: 'A cart icon linking to the cart, with a live count of items in it.',
    fields: [
      text('label', 'Accessible name'),
      { name: 'showCount', label: 'Show the item count', type: 'checkbox' },
    ],
    defaultProps: () => ({ label: 'View cart', showCount: true }),
  },
  {
    type: 'cart-lines', label: 'Cart lines', icon: String.fromCodePoint(0x1f6d2), category: 'commerce',
    description: 'The items in the cart with quantity, remove and save for later, the empty-cart message and the saved for later list. Part of a cart page layout.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'cart-totals', label: 'Cart coupon and estimate', icon: String.fromCodePoint(0x1f9fe), category: 'commerce',
    description: 'Free-shipping bar, coupon code, shipping estimate and tax, and the order note and gift message. Shows nothing while the cart is empty.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'cart-extras', label: 'Cart cross-sells', icon: String.fromCodePoint(0x1f381), category: 'commerce',
    description: 'You may also like products under the cart. Shows nothing while the cart is empty or when cross-sells and recommendations are off.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'cart-summary', label: 'Cart subtotal and checkout', icon: String.fromCodePoint(0x1f4b3), category: 'commerce',
    description: 'Subtotal, pay later message and the Checkout button. Shows nothing while the cart is empty.',
    fields: [],
    defaultProps: () => ({}),
  },
  {
    type: 'product-rating', label: 'Product rating', icon: String.fromCodePoint(0x2b50), category: 'commerce',
    description: 'Average star rating and review count of the product on this page.',
    fields: [{ name: 'showCount', label: 'Show the review count', type: 'checkbox' }],
    defaultProps: () => ({ showCount: true }),
  },
]
