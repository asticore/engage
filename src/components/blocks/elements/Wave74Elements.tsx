'use client'
import React, { Suspense } from 'react'

import { CartPageClient } from '@/components/CartPageClient'
import { CheckoutCurrencyNote } from '@/components/CheckoutCurrencyNote'
import { CheckoutForm } from '@/components/CheckoutForm'
import { useCart } from '@/engine/commerce/react'

import { str } from './elementUtil'

/** Wave 74 client elements (Task 10, 29d): cart contents, checkout form and mini cart. Defs: wave74Defs.ts. No payment or cart code here. */

type P = Record<string, unknown>

/** The cart page body, the same component the built-in cart page uses. */
export function CartContentsElement(_props: P): React.ReactElement {
  return <CartPageClient />
}

/** The checkout page body: the currency note and the form, which needs a Suspense boundary for its search params. */
export function CheckoutFormElement(_props: P): React.ReactElement {
  return (
    <div className="checkout-page">
      <CheckoutCurrencyNote />
      <Suspense fallback={null}>
        <CheckoutForm />
      </Suspense>
    </div>
  )
}

/**
 * The cart button. It is a plain link to /cart on purpose: MiniCart.tsx takes over every click on a cart link and opens
 * the drawer or dropdown, and it leaves links alone that were already handled (next/link), so a plain anchor is needed.
 */
export function MiniCartElement(props: P): React.ReactElement {
  const { cart } = useCart()
  const count = (cart?.items ?? []).reduce((n, i) => n + (i.quantity || 0), 0)
  const label = str(props.label) || 'Cart'
  const showCount = props.showCount !== false
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages -- a plain anchor, so MiniCart's click handler takes it over
    <a href="/cart" className="btn btn--secondary">
      {label}
      {showCount ? ` (${count})` : null}
    </a>
  )
}

export const WAVE74_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'cart-contents': CartContentsElement,
  'checkout-form': CheckoutFormElement,
  'mini-cart': MiniCartElement,
}
