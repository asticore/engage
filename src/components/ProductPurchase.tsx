'use client'

import { useShopPath } from '@/features/seo/ShopBaseContext'
import { announceCartAdded } from '@/features/ecommerce/lib/miniCart'
import { useStoreText } from '@/features/uiStrings/StoreTextsContext'
import { useCart } from '@/engine/commerce/react'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { GiftCardForm, type GiftCardConfig } from '@/components/GiftCardForm'
import { PayLaterMessage } from '@/components/PayLaterMessage'
import { QtyPriceFields } from '@/components/QtyPriceFields'
import { clampQuantity, validateNamedPrice } from '@/features/ecommerce/lib/qtyLimits'
import { PREORDER_LABEL } from '@/features/ecommerce/lib/preorder'
import { imageForSelection } from '@/features/ecommerce/lib/variationImage'
import type { AddOnView } from '@/features/ecommerce/lib/addOns'
import { ProductAddOns, type AddOnValues } from './ProductAddOns'
import { CompositePicker, type CompositeView } from './CompositePicker'
import { PricingRuleNotes } from './PricingRuleNotes'
import { PreorderNotice } from './PreorderNotice'
import { useVariationImage } from './VariationImageProvider'
import { useDisplayMoney } from '@/components/DisplayCurrencyContext'
import type { DonationView } from '@/features/ecommerce/lib/donations'
import type { ProductView, VariationView } from '@/features/ecommerce/storefront'

export type GroupedChild = { id: number; title: string; slug: string | null; view: ProductView }

function PriceLine({ price, regular, onSale, from }: { price: number | null; regular: number | null; onSale: boolean; from?: boolean }) {
  const t = useStoreText()
  const money = useDisplayMoney()
  if (price === null) return null
  return (
    <p className="mb-2 font-[family-name:var(--font-display)] text-[1.5rem]">
      {onSale && regular !== null && regular > price ? (
        <>
          <s className="mr-2 opacity-50">{money(regular)}</s>
          <span>{money(price)}</span>
          <span className="sale-badge ml-3 align-middle text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-gold)]">{t('store.sale')}</span>
        </>
      ) : (
        <span>
          {from ? t('store.from') : ''}
          {money(price)}
        </span>
      )}
    </p>
  )
}

type Limits = { min: number; max: number | null; step?: number }
type BuyerPrice = { enabled: boolean; suggested: number | null; minimum: number | null }

/** Quantity box plus Add to cart. The server re-checks price, stock, limits and the option; it can still say no. */
function AddControl({ productId, variationId, disabled, label, limits, buyerPrice, addOns = [], donation = null }: { productId: number; variationId?: string | null; disabled?: boolean; label?: string; limits?: Limits; buyerPrice?: BuyerPrice; addOns?: AddOnView[]; donation?: DonationView | null }) {
  const t = useStoreText()
  const { addItem, isLoading } = useCart()
  const min = limits?.min ?? 1
  const cap = limits?.max ?? 99
  const step = limits?.step ?? 1
  // Whole cartons or pallets: the box moves in steps and a typed amount is raised to the next full step.
  const snap = (value: number): number => {
    const bounded = clampQuantity(value, { minQty: min, maxQty: cap })
    return step > 1 ? Math.max(min, Math.ceil(bounded / step) * step) : bounded
  }
  const named = buyerPrice?.enabled ? buyerPrice : null
  const [qty, setQty] = useState(() => snap(1))
  const [answers, setAnswers] = useState<AddOnValues>({})
  const [priceText, setPriceText] = useState(() => (named?.suggested != null ? named.suggested.toFixed(2) : ''))
  const [message, setMessage] = useState('')
  const [added, setAdded] = useState(false)

  const add = async () => {
    setMessage('')
    let priceCents: number | undefined
    if (named) {
      const minimumCents = named.minimum != null ? Math.floor(named.minimum * 100 + 1e-9) : null
      const check = validateNamedPrice(Math.round(Number(priceText) * 100), { minPrice: minimumCents })
      if (!check.ok || check.cents == null) {
        setMessage(check.error ?? t('store.invalidAmount'))
        return
      }
      priceCents = check.cents
      if (donation?.max != null && check.cents > Math.round(donation.max * 100)) {
        setMessage(`The largest donation is ${donation.max.toFixed(2)}.`)
        return
      }
    }
    // Only the answers the buyer gave go to the server; it checks them against the product and prices them.
    const addOnAnswers = addOns.flatMap((def) => {
      const value = answers[def.id]
      if (value === undefined || value === '' || value === false) return []
      return [{ id: def.id, value }]
    })
    const failure = await addItem({ product: productId, variation: variationId ?? null, ...(priceCents !== undefined ? { priceCents } : {}), ...(addOnAnswers.length > 0 ? { addOns: addOnAnswers } : {}) }, snap(qty))
    if (failure) setMessage(failure)
    else {
      setAdded(true)
      announceCartAdded()
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        {donation && donation.amounts.length > 0 ? (
          <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Suggested amounts">
            {donation.amounts.map((amount) => (
              <button key={amount} type="button" className="btn" aria-pressed={Number(priceText) === amount} onClick={() => setPriceText(amount.toFixed(2))}>{amount.toFixed(2)}</button>
            ))}
          </div>
        ) : null}
        <ProductAddOns defs={addOns} values={answers} onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))} />
        <QtyPriceFields qty={qty} onQty={(value) => setQty(value)} min={min} max={limits?.max ?? null} step={step} buyerPrice={named} priceText={priceText} onPriceText={setPriceText} />
        <button type="button" className="btn btn--primary" onClick={add} disabled={disabled || isLoading}>
          {isLoading ? t('store.addingProgress') : (label ?? t('store.addToCart'))}
        </button>
      </div>
      {message ? (
        <p role="alert" className="mt-2 text-[0.9rem] text-[#b3261e]">
          {message}
        </p>
      ) : null}
      {added && !message ? (
        <p role="status" className="mt-2">
          Added to your cart. <Link href="/cart">View cart</Link>
        </p>
      ) : null}
    </div>
  )
}

export function ProductPurchase({ productId, view, grouped = [], giftConfig, composite, hiddenPriceText }: { productId: number; view: ProductView; grouped?: GroupedChild[]; giftConfig?: GiftCardConfig; composite?: CompositeView | null; hiddenPriceText?: string }) {
  const t = useStoreText()
  const shop = useShopPath()
  const [selection, setSelection] = useState<Record<string, string>>({})
  const { setImageUrl } = useVariationImage()

  const chosen: VariationView | null = useMemo(() => {
    if (view.type !== 'variable' || view.options.length === 0) return null
    if (view.options.some((option) => !selection[option.name])) return null
    return view.variations.find((variation) => view.options.every((option) => (variation.attributes[option.name] ?? '').toLowerCase() === selection[option.name].toLowerCase())) ?? null
  }, [selection, view])

  // Wholesale mode: the page already removed the prices; show the shop's text instead of the buy controls.
  if (hiddenPriceText) return <p className="my-4">{hiddenPriceText}</p>

  if (view.type === 'giftcard') {
    return giftConfig ? <GiftCardForm productId={productId} config={giftConfig} /> : <p>{t('store.giftCardsUnavailable')}</p>
  }

  if (view.type === 'composite') {
    return composite ? <CompositePicker productId={productId} view={composite} disabled={!view.purchasable} /> : <p>{t('store.productUnavailable')}</p>
  }

  if (view.type === 'external') {
    return (
      <div>
        <PriceLine price={view.price} regular={view.regular} onSale={view.onSale} />
        {view.sku ? <p className="text-[0.85rem] opacity-70">SKU: {view.sku}</p> : null}
        {view.external ? (
          <>
            <a className="btn btn--primary mt-3 inline-block" href={view.external.url} target="_blank" rel="noopener noreferrer nofollow sponsored">
              {view.external.label}
            </a>
            <p className="mt-2 text-[0.8rem] opacity-70">{t('store.affiliateDisclosure')}</p>
          </>
        ) : (
          <p>{t('store.productUnavailable')}</p>
        )}
      </div>
    )
  }

  if (view.type === 'grouped') {
    return (
      <div>
        {grouped.length === 0 ? <p>{t('store.noProductsInGroup')}</p> : null}
        <ul className="m-0 list-none border-t border-[var(--color-line)] p-0">
          {grouped.map((child) => (
            <li key={child.id} className="border-b border-[var(--color-line)] py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {child.slug ? <Link href={shop(`/${child.slug}`)}>{child.title}</Link> : child.title}
                  <p className="text-[0.85rem] opacity-70">{child.view.stockMessage}</p>
                </div>
                <PriceLine price={child.view.price} regular={child.view.regular} onSale={child.view.onSale} />
              </div>
              {child.view.purchasable ? <AddControl productId={child.id} /> : child.view.type === 'variable' && child.slug ? <Link href={shop(`/${child.slug}`)}>Choose an option</Link> : null}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (view.type === 'variable') {
    const shown = chosen
    return (
      <div>
        {shown ? <PriceLine price={shown.price} regular={shown.regular} onSale={shown.onSale} /> : <PriceLine price={view.priceMin} regular={null} onSale={false} from={view.priceMin !== view.priceMax} />}
        {view.options.map((option) => (
          <label key={option.name} className="mb-3 block">
            <span className="mb-1 block text-[0.8rem] uppercase tracking-[0.06em]">{option.name}</span>
            <select
              className="w-full border border-[var(--color-line)] p-2"
              value={selection[option.name] ?? ''}
              onChange={(event) => {
                const next = { ...selection, [option.name]: event.target.value }
                setSelection(next)
                setImageUrl(imageForSelection(view.variations, view.options, next))
              }}
            >
              <option value="">{t('store.chooseOption')}</option>
              {option.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
        {shown ? (
          <>
            <p className="text-[0.9rem]" data-stock={shown.stockStatus}>
              {shown.stockMessage}
            </p>
            {shown.sku ? <p className="text-[0.85rem] opacity-70">SKU: {shown.sku}</p> : null}
          </>
        ) : view.options.length > 0 ? (
          <p className="text-[0.9rem] opacity-70">Choose every option to see the price and availability.</p>
        ) : (
          <p>{t('store.productUnavailable')}</p>
        )}
        {shown ? <PreorderNotice info={shown.preorder} /> : null}
        <PricingRuleNotes notes={view.pricingNotes} />
        <AddControl productId={productId} variationId={shown?.id ?? null} disabled={!shown || !shown.purchasable} limits={view.qtyLimits} label={shown?.preorder.active ? PREORDER_LABEL : undefined} addOns={view.addOns} />
      </div>
    )
  }

  return (
    <div>
      <PriceLine price={view.price} regular={view.regular} onSale={view.onSale} />
      <PayLaterMessage amountDollars={view.price} />
      <p className="text-[0.9rem]" data-stock={view.stockStatus}>
        {view.stockMessage}
      </p>
      {view.sku ? <p className="text-[0.85rem] opacity-70">SKU: {view.sku}</p> : null}
      <PreorderNotice info={view.preorder} />
      <PricingRuleNotes notes={view.pricingNotes} />
      <AddControl productId={productId} disabled={!view.purchasable} limits={view.qtyLimits} buyerPrice={view.buyerPrice} label={view.donation ? 'Donate' : view.preorder.active ? PREORDER_LABEL : undefined} addOns={view.addOns} donation={view.donation} />
    </div>
  )
}
