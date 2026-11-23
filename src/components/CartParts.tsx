'use client'

import { useShopPath } from '@/features/seo/ShopBaseContext'
import Link from 'next/link'
import React from 'react'

import { BundleContentsList } from '@/components/BundleContentsList'
import { CartHoldNotice } from '@/components/CartHoldNotice'
import { CartCrossSells } from '@/components/CartCrossSells'
import { CartEstimate } from '@/components/CartEstimate'
import { CartNoteBox } from '@/components/CartNoteBox'
import { CartRecommendations } from '@/components/CartRecommendations'
import { useDisplayCurrencyState, useDisplayMoney } from '@/components/DisplayCurrencyContext'
import { FreeShippingBar } from '@/components/FreeShippingBar'
import { PayLaterMessage } from '@/components/PayLaterMessage'
import { SavedForLaterList, useSavedForLater } from '@/components/SavedForLater'
import { useCart } from '@/engine/commerce/react'
import type { Product } from '@/engage-types'
import { resolveCartLine, type CatalogueProduct } from '@/features/ecommerce/catalogue'
import { addOnSummary, readAddOnChoices } from '@/features/ecommerce/lib/addOns'
import { useBundleInfo } from '@/features/ecommerce/lib/useBundleInfo'
import { useCompositeInfo } from '@/features/ecommerce/lib/useCompositeInfo'
import { useStoreText } from '@/features/uiStrings/StoreTextsContext'

/**
 * The parts of the cart page (Task 23d). The cart page is built from these, and each is also a visual editor element
 * (cart-lines, cart-totals, cart-extras, cart-summary), so a cart layout can be composed on any page. They share the cart
 * through the storefront provider, so they work in any order.
 */

/** The cart lines (quantity, remove, save for later), the empty-cart message and the saved for later list. */
export const CartLinesPart: React.FC = () => {
  const { cart, decrementItem, incrementItem, removeItem, isLoading } = useCart()
  const t = useStoreText()
  const shop = useShopPath()
  const money = useDisplayMoney()
  const savedLater = useSavedForLater()
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const items = cart?.items || []
  const bundles = useBundleInfo(items.map((item) => (typeof item.product === 'object' && item.product ? Number((item.product as { id?: unknown }).id) : 0)).filter((id) => id > 0))
  const kits = useCompositeInfo(
    items.flatMap((item) => {
      const p = item.product as unknown as { id?: unknown; productType?: string } | null
      return typeof p === 'object' && p !== null && p.productType === 'composite' ? [{ key: item.id, productId: Number(p.id), composite: item.composite }] : []
    }),
  )
  return (
    <div ref={listRef} tabIndex={-1} data-cart-part="lines">
      {items.length === 0 ? (
        <>
          <p>
            {t('store.emptyCart')} <Link href={shop()}>{t('store.continueShopping')}</Link>
          </p>
          {!isLoading && <CartRecommendations empty />}
        </>
      ) : (
      <ul className="mb-8 list-none border-t border-[var(--color-line)] p-0">
        {items.map((item) => {
          const product = item.product as unknown as Product
          // Display only: the server prices the cart from the database (see the cart hook).
          const isBundle = typeof product === 'object' && product !== null && (product as unknown as { productType?: string }).productType === 'bundle'
          const bundle = isBundle ? bundles[String((product as { id: number }).id)] : undefined
          const isKit = typeof product === 'object' && product !== null && (product as unknown as { productType?: string }).productType === 'composite'
          const kit = isKit ? kits[item.id] : undefined
          const line = typeof product === 'object' && !isBundle && !isKit ? resolveCartLine(product as unknown as CatalogueProduct, item.variation ?? null, 1) : null
          // Warns when the quantity in the cart can no longer be bought (stock, limits). The server decides again at checkout.
          const whole = typeof product === 'object' && !isBundle && !isKit ? resolveCartLine(product as unknown as CatalogueProduct, item.variation ?? null, item.quantity) : null
          const stockWarning = whole && !whole.ok ? (whole as { error: string }).error : null
          const unitPrice = isKit ? (kit && kit.priceCents !== null ? kit.priceCents / 100 : null) : isBundle ? (bundle && bundle.priceCents !== null ? bundle.priceCents / 100 : null) : line && line.ok ? line.unitPrice : typeof product === 'object' ? product.priceInAUD : null
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-6 border-b border-[var(--color-line)] py-5"
            >
              <div>
                <h3>{typeof product === 'object' ? product.title : t('store.item')}</h3>
                {line && line.ok && line.variationLabel ? <p className="opacity-70">{line.variationLabel}</p> : null}
                {readAddOnChoices(item.addOns).length > 0 ? <p className="text-[0.85rem] opacity-70">{addOnSummary(readAddOnChoices(item.addOns))}</p> : null}
                {kit && kit.summary ? <p className="text-[0.85rem] opacity-70">{kit.summary}</p> : null}
                <p>{money(unitPrice)}</p>
                {isBundle && bundle ? <BundleContentsList items={bundle.contents} /> : null}
                {stockWarning ? <p role="alert" className="text-[#b3261e]">{stockWarning}</p> : null}
              {isKit && kit && !kit.available ? <p role="alert" className="text-[#b3261e]">This kit is not available right now.</p> : null}
              {isBundle && bundle && !bundle.available ? <p role="alert" className="text-[#b3261e]">This bundle is not available right now.</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-7 w-7 cursor-pointer border border-[var(--color-ink)] bg-transparent"
                  onClick={() => decrementItem(item.id)}
                  disabled={isLoading}
                  aria-label={`Decrease quantity of ${typeof product === 'object' ? product.title : t('store.item')}`}
                >
                  -
                </button>
                <span aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                <button
                  type="button"
                  className="h-7 w-7 cursor-pointer border border-[var(--color-ink)] bg-transparent"
                  onClick={() => incrementItem(item.id)}
                  disabled={isLoading}
                  aria-label={`Increase quantity of ${typeof product === 'object' ? product.title : t('store.item')}`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className="cursor-pointer border-none bg-none text-[0.85rem] underline"
                onClick={() => {
                  if (typeof product !== 'object' || product === null) return
                  savedLater.save({ product: Number((product as { id: number }).id), variation: item.variation ?? null, quantity: item.quantity, title: product.title, note: line && line.ok ? line.variationLabel : null })
                  void removeItem(item.id)
                  listRef.current?.focus()
                }}
                disabled={isLoading || typeof product !== 'object' || isKit || readAddOnChoices(item.addOns).length > 0}
                aria-label={`Save ${typeof product === 'object' ? product.title : t('store.item')} for later`}
              >
                Save for later
              </button>
              <button
                type="button"
                className="cursor-pointer border-none bg-none text-[0.85rem] underline"
                onClick={() => {
                  void removeItem(item.id)
                  listRef.current?.focus()
                }}
                disabled={isLoading}
                aria-label={`Remove ${typeof product === 'object' ? product.title : t('store.item')}`}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>
      )}
      <SavedForLaterList saved={savedLater.saved} moveBack={savedLater.moveBack} discard={savedLater.discard} message={savedLater.message} />
    </div>
  )
}

/** Free-shipping bar, coupon and shipping estimate, order note and gift message. Nothing while the cart is empty. */
export const CartTotalsPart: React.FC = () => {
  const { cart } = useCart()
  const money = useDisplayMoney()
  if (!(cart?.items?.length)) return null
  return (
    <div data-cart-part="totals">
      <CartHoldNotice />
      <FreeShippingBar subtotal={cart.subtotal} money={money} />
      <CartEstimate />
      <CartNoteBox />
    </div>
  )
}

/** Cross-sells and recommendations. Nothing while the cart is empty. */
export const CartExtrasPart: React.FC = () => {
  const { cart } = useCart()
  if (!(cart?.items?.length)) return null
  return (
    <div data-cart-part="extras">
      <CartCrossSells />
      <CartRecommendations />
    </div>
  )
}

/** Pay later message, subtotal and the checkout button. Nothing while the cart is empty. */
export const CartSummaryPart: React.FC = () => {
  const { cart } = useCart()
  const t = useStoreText()
  const money = useDisplayMoney()
  const displayState = useDisplayCurrencyState()
  if (!(cart?.items?.length)) return null
  return (
    <div data-cart-part="summary">
      <PayLaterMessage amountDollars={typeof cart.subtotal === 'number' ? cart.subtotal : null} />
      {displayState.selected ? <p className="opacity-70">Converted prices are approximate. You pay in {displayState.base} at checkout.</p> : null}
      <div className="flex items-center justify-between">
        <p>
          {t('store.subtotal')}: <strong>{money(cart.subtotal)}</strong>
        </p>
        <Link href="/checkout" className="btn btn--primary">
          Checkout
        </Link>
      </div>
    </div>
  )
}

/** A compact list of the cart lines (quantity, remove) with the empty-cart message. The mini cart drawer is built from this, and it is the cart-lines-compact element. */
export const MiniCartLinesPart: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const shop = useShopPath()
  const { cart, decrementItem, incrementItem, removeItem, isLoading } = useCart()
  const money = useDisplayMoney()
  const items = cart?.items ?? []
  if (items.length === 0) {
    return (
      <p data-cart-part="lines-compact">
        Your cart is empty. <Link href={shop()} onClick={onNavigate}>Continue shopping</Link>
      </p>
    )
  }
  return (
      <ul data-cart-part="lines-compact" className="m-0 mb-4 list-none border-t border-[var(--color-line)] p-0">
        {items.map((item) => {
          const product = item.product as unknown as Product
          const isObj = typeof product === 'object' && product !== null
          const isBundle = isObj && (product as unknown as { productType?: string }).productType === 'bundle'
          const isKitLine = isObj && (product as unknown as { productType?: string }).productType === 'composite'
          const line = isObj && !isBundle && !isKitLine ? resolveCartLine(product as unknown as CatalogueProduct, item.variation ?? null, 1) : null
          const unit = line && line.ok ? line.unitPrice : isObj ? product.priceInAUD : null
          const title = isObj ? product.title : 'Item'
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] py-3">
              <div className="min-w-0">
                <p className="m-0 truncate font-medium">{title}</p>
                {line && line.ok && line.variationLabel ? <p className="m-0 text-[0.85rem] opacity-70">{line.variationLabel}</p> : null}
                <p className="m-0 text-[0.85rem]">{isBundle || isKitLine ? '' : money(unit)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Decrease quantity of ${title}`} className="h-7 w-7 cursor-pointer border border-[var(--color-ink)] bg-transparent" onClick={() => void decrementItem(item.id)} disabled={isLoading}>
                  -
                </button>
                <span aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                <button type="button" aria-label={`Increase quantity of ${title}`} className="h-7 w-7 cursor-pointer border border-[var(--color-ink)] bg-transparent" onClick={() => void incrementItem(item.id)} disabled={isLoading}>
                  +
                </button>
                <button type="button" aria-label={`Remove ${title}`} className="cursor-pointer border-none bg-transparent text-[0.85rem] underline" onClick={() => void removeItem(item.id)} disabled={isLoading}>
                  Remove
                </button>
              </div>
            </li>
          )
        })}
      </ul>
  )
}
