import type { ElementDef } from './registry'

/**
 * Wave 72 (Task 10, 29d): the Pay button. It adds a product to the cart and goes straight to the checkout, which
 * runs the normal payment methods (test mode until the shop turns live payments on). No payment code lives here.
 * Renderer: Wave72Elements.tsx. Icons are String.fromCodePoint escapes.
 */

export const WAVE72_ELEMENTS: ElementDef[] = [
  {
    type: 'pay-button', label: 'Pay button', icon: String.fromCodePoint(0x1f4b3), category: 'commerce',
    description: 'A buy now button: puts one product in the cart and opens the checkout. For pay what you want or donation products it can show an amount box.',
    fields: [
      { name: 'label', label: 'Button label', type: 'text' },
      { name: 'productId', label: 'Product ID', type: 'number', width: 'half', helpText: 'The product to buy.' },
      { name: 'quantity', label: 'Quantity', type: 'number', width: 'half' },
      { name: 'askAmount', label: 'Let the buyer type an amount (pay what you want or donation products)', type: 'checkbox' },
      { name: 'amount', label: 'Suggested amount', type: 'number', width: 'half', helpText: 'In whole currency units, like 25.' },
      { name: 'minAmount', label: 'Smallest amount', type: 'number', width: 'half', helpText: 'The shop checks this again on the server.' },
    ],
    defaultProps: () => ({ label: 'Buy now', productId: undefined, quantity: 1, askAmount: false, amount: undefined, minAmount: undefined }),
  },
]
