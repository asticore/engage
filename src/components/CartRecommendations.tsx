'use client'

import { useCart } from '@/engine/commerce/react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { AddToCartButton } from '@/components/AddToCartButton'
import { useShopCurrency } from '@/components/ShopCurrencyContext'
import { cartProductIds, type CrossSellCard } from '@/features/ecommerce/lib/crossSells'
import { formatPriceInAUD } from '@/lib/formatCurrency'
import { useShopPath } from '@/features/seo/ShopBaseContext'

/** "Customers also bought" under the cart items, from paid orders and same-category products. Hidden when empty or switched off. */
export function CartRecommendations({ empty = false }: { empty?: boolean } = {}) {
  const shop = useShopPath()
  const { cart } = useCart()
  const currency = useShopCurrency()
  const ids = cartProductIds(cart?.items as Array<{ product?: unknown }> | undefined)
  const key = ids.join(',')
  const [result, setResult] = useState<{ key: string; cards: CrossSellCard[] } | null>(null)

  useEffect(() => {
    if (!key && !empty) return
    let active = true
    fetch('/api/shop-recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: key ? key.split(',').map(Number) : [] }),
    })
      .then((res): Promise<unknown> => (res.ok ? res.json() : Promise.resolve([])))
      .then((data: unknown) => {
        if (active) setResult({ key, cards: Array.isArray(data) ? (data as CrossSellCard[]) : [] })
      })
      .catch(() => {
        if (active) setResult({ key, cards: [] })
      })
    return () => {
      active = false
    }
  }, [key, empty])

  const cards = result?.key === key && (key || empty) ? result.cards : []
  if (cards.length === 0) return null

  return (
    <section className="mb-8" aria-labelledby="cart-recommendations-heading">
      <h2 id="cart-recommendations-heading" className="mb-4 text-[1.25rem]">
        {empty ? 'You might like' : 'Customers also bought'}
      </h2>
      <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5 p-0">
        {cards.map((card) => (
          <li key={card.id} className="flex flex-col gap-2">
            <Link href={card.slug ? shop(`/${card.slug}`) : shop()} className="block">
              {card.image ? (
                <Image src={card.image} alt={card.title} width={320} height={400} style={{ objectFit: 'cover', width: '100%', height: 'auto' }} />
              ) : (
                <div className="aspect-[4/5] bg-[image:linear-gradient(135deg,var(--color-cream-dim),var(--color-gold-light))]" aria-hidden />
              )}
              <span className="mt-2 block">{card.title}</span>
            </Link>
            <p>{formatPriceInAUD(card.price, currency)}</p>
            <AddToCartButton productID={card.id} />
          </li>
        ))}
      </ul>
    </section>
  )
}
