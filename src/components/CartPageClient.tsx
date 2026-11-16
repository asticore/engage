'use client'

import { useCart } from '@/engine/commerce/react'
import React from 'react'

import { CartExtrasPart, CartLinesPart, CartSummaryPart, CartTotalsPart } from '@/components/CartParts'
import { useDisplayMoney } from '@/components/DisplayCurrencyContext'
import { useStoreText } from '@/features/uiStrings/StoreTextsContext'

/** The built-in cart page, composed from the same parts the visual editor offers as elements (components/CartParts.tsx). */
export function CartPageClient() {
  const { cart, notice } = useCart()
  const t = useStoreText()
  const money = useDisplayMoney()
  const headingRef = React.useRef<HTMLHeadingElement | null>(null)
  const items = cart?.items || []

  return (
    <div className="page-shell">
      <h1 ref={headingRef} tabIndex={-1}>
        {t('store.yourCart')}
      </h1>
      {notice && <p role="status" className="cart-notice">{notice}</p>}
      <p role="status" aria-live="polite" className="sr-only">
        {items.length === 0 ? '' : `${items.reduce((n, i) => n + (i.quantity || 0), 0)} items in your cart, subtotal ${money(cart?.subtotal)}`}
      </p>
      <CartLinesPart />
      <CartExtrasPart />
      <CartTotalsPart />
      <CartSummaryPart />
    </div>
  )
}
