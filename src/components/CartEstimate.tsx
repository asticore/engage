'use client'

import React, { useEffect, useId, useState } from 'react'

import { useCart } from '@/engine/commerce/react'
import { useDisplayMoney } from '@/components/DisplayCurrencyContext'

type Quote = {
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  shippingOptions?: Array<{ id: string; title: string; costCents: number }>
  coupon?: { code?: string } | null
  couponError?: string | null
  wholesaleMinOrder?: { minCents: number; shortfallCents: number } | null
}

const KEY = 'engage-cart-estimate'

/**
 * Coupon code, shipping estimate (country and postcode) and tax for the cart page and the mini cart (Task 28c).
 * Uses the same server quote as checkout, so the numbers match. English only for now.
 */
export const CartEstimate: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { cart, cartRef } = useCart()
  const money = useDisplayMoney()
  const uid = useId()
  const [country, setCountry] = useState('')
  const [postcode, setPostcode] = useState('')
  const [coupon, setCoupon] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signature = (cart?.items ?? []).map((i) => `${typeof i.product === 'object' && i.product ? (i.product as { id?: number }).id : i.product}:${i.variation ?? ''}:${i.quantity}`).join('|')

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as { country?: string; postcode?: string; coupon?: string }
      setCountry(saved.country ?? '')
      setPostcode(saved.postcode ?? '')
      setCoupon(saved.coupon ?? '')
    } catch {
      // Private browsing: start empty.
    }
  }, [])

  async function run(next: { country: string; postcode: string; coupon: string }): Promise<void> {
    if (!cartRef) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/shop-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartID: cartRef.id, secret: cartRef.secret, address: { country: next.country.trim().toUpperCase() || undefined, postalCode: next.postcode.trim() || undefined }, couponCode: next.coupon.trim() || undefined }),
      })
      const body = (await res.json().catch((): null => null)) as (Quote & { error?: string }) | null
      if (!res.ok || !body) {
        setQuote(null)
        setError(body?.error ?? 'Could not work out the estimate.')
      } else {
        setQuote(body)
        try {
          window.localStorage.setItem(KEY, JSON.stringify(next))
          window.dispatchEvent(new Event('cart-estimate-changed'))
        } catch {
          // Not saved.
        }
      }
    } catch {
      setError('Could not work out the estimate.')
    } finally {
      setBusy(false)
    }
  }

  // Re-price when the lines change, once an estimate has been asked for.
  useEffect(() => {
    if (quote || coupon || country) void run({ country, postcode, coupon })
    // Only the cart lines trigger this; the fields are applied by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, cartRef?.id])

  return (
    <form
      className={compact ? 'mb-4 grid gap-2' : 'mb-6 grid max-w-md gap-3'}
      aria-label="Coupon and shipping estimate"
      onSubmit={(e) => {
        e.preventDefault()
        void run({ country, postcode, coupon })
      }}
    >
      <div className="flex gap-2">
        <label className="grid flex-1 gap-1 text-[0.85rem]" htmlFor={`${uid}-coupon`}>
          Coupon code
          <input id={`${uid}-coupon`} value={coupon} onChange={(e) => setCoupon(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <div className="flex gap-2">
        <label className="grid w-24 gap-1 text-[0.85rem]" htmlFor={`${uid}-country`}>
          Country
          <input id={`${uid}-country`} value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} placeholder="AU" autoComplete="country" />
        </label>
        <label className="grid flex-1 gap-1 text-[0.85rem]" htmlFor={`${uid}-postcode`}>
          Postcode
          <input id={`${uid}-postcode`} value={postcode} onChange={(e) => setPostcode(e.target.value)} autoComplete="postal-code" />
        </label>
      </div>
      <button type="submit" className="btn" disabled={busy || !cartRef}>
        {busy ? 'Working it out…' : 'Update estimate'}
      </button>
      <div role="status" aria-live="polite">
        {error ? <p className="m-0 text-[#b3261e]">{error}</p> : null}
        {quote?.wholesaleMinOrder && quote.wholesaleMinOrder.shortfallCents > 0 ? (
          <p className="m-0" role="status">Wholesale orders start at {money(quote.wholesaleMinOrder.minCents / 100)}. Add {money(quote.wholesaleMinOrder.shortfallCents / 100)} more to check out.</p>
        ) : null}
        {quote?.couponError ? <p className="m-0 text-[#b3261e]">{quote.couponError}</p> : null}
        {quote ? (
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            <dt>Subtotal</dt>
            <dd className="m-0 text-right">{money(quote.subtotalCents / 100)}</dd>
            {quote.discountCents > 0 ? (
              <>
                <dt>Discount</dt>
                <dd className="m-0 text-right">-{money(quote.discountCents / 100)}</dd>
              </>
            ) : null}
            <dt>Shipping{quote.shippingOptions && quote.shippingOptions.length > 1 ? ' (cheapest shown)' : ''}</dt>
            <dd className="m-0 text-right">{country || postcode ? money(quote.shippingCents / 100) : 'Add a country'}</dd>
            <dt>Tax</dt>
            <dd className="m-0 text-right">{money(quote.taxCents / 100)}</dd>
            <dt>
              <strong>Estimated total</strong>
            </dt>
            <dd className="m-0 text-right">
              <strong>{money(quote.totalCents / 100)}</strong>
            </dd>
          </dl>
        ) : null}
      </div>
    </form>
  )
}
