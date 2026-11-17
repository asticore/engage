'use client'

import React, { useEffect, useState } from 'react'

import { useCart } from '@/engine/commerce/react'
import { useShopCurrency } from '@/components/ShopCurrencyContext'
import { formatMoney } from '@/features/ecommerce/lib/money'

type Offer = { id: number; title: string; price: number; headline: string }
type Line = { id: string; product?: unknown }

const productIdOf = (line: Line): number | null => {
  const p = line.product
  if (typeof p === 'number') return p
  if (p && typeof p === 'object' && 'id' in p) return Number((p as { id: unknown }).id)
  return null
}

/** Tick-box offer on the checkout: one extra product, set on a product in the cart (api/shop-order-bump). */
export function OrderBump(): React.ReactElement | null {
  const { cart, addItem, removeItem } = useCart()
  const currency = useShopCurrency()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [busy, setBusy] = useState(false)
  const lines = ((cart?.items ?? []) as unknown as Line[]).filter((l) => productIdOf(l) !== null)
  const ids = lines.map((l) => productIdOf(l) as number)
  const key = ids.join(',')
  const bumpLine = offer ? lines.find((l) => productIdOf(l) === offer.id) : undefined

  useEffect(() => {
    let live = true
    if (!key) return
    const productIds = key.split(',').map(Number)
    fetch('/api/shop-order-bump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, bumpId: offer?.id }),
    })
      .then((r): Promise<unknown> => (r.ok ? r.json() : Promise.resolve(null)))
      .then((d: unknown) => {
        if (live) setOffer(d && typeof d === 'object' && 'id' in d ? (d as Offer) : null)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!offer) return null
  const toggle = async (on: boolean): Promise<void> => {
    setBusy(true)
    if (on) await addItem({ product: offer.id }, 1)
    else if (bumpLine) await removeItem(bumpLine.id)
    setBusy(false)
  }
  return (
    <label className="flex items-center gap-2 border border-dashed border-[var(--color-line)] p-3">
      <input type="checkbox" checked={Boolean(bumpLine)} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
      <span>{offer.headline || `Add ${offer.title} (+${formatMoney(Math.round(offer.price * 100), currency)})`}</span>
    </label>
  )
}
