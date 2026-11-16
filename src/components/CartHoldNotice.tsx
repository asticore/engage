'use client'

import { useCart } from '@/engine/commerce/react'
import React, { useEffect, useState } from 'react'

import { holdCountdown } from '@/features/ecommerce/lib/holdCountdown'

/**
 * "Your items are held for 12:34" on the cart page, when the shop holds stock (Shop switches). Shows nothing when nothing is held.
 * The countdown ticks once a second but is announced only when it starts and when it ends, so screen readers are not flooded. English only.
 */
export const CartHoldNotice: React.FC = () => {
  const { cart, cartRef } = useCart()
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const signature = (cart?.items ?? []).map((i) => `${typeof i.product === 'object' && i.product ? (i.product as { id?: number }).id : i.product}:${i.variation ?? ''}:${i.quantity}`).join('|')

  useEffect(() => {
    if (!cartRef?.id || !signature) {
      setExpiresAt(null)
      return
    }
    let live = true
    fetch('/api/shop-stock-hold', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cartID: cartRef.id, secret: cartRef.secret }) })
      .then((r): Promise<unknown> => (r.ok ? r.json() : Promise.resolve(null)))
      .then((data: unknown) => {
        const at = (data as { expiresAt?: string | null } | null)?.expiresAt
        if (live) setExpiresAt(at ? new Date(at).getTime() : null)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [cartRef?.id, cartRef?.secret, signature])

  useEffect(() => {
    if (expiresAt === null) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  if (expiresAt === null || !cart?.items?.length) return null
  const countdown = holdCountdown(expiresAt - now)
  return (
    <div className="mb-4" data-testid="cart-hold-notice">
      <p className="m-0" aria-hidden="true">
        {countdown.ended ? 'Your hold has ended. Stock may change.' : `Your items are held for ${countdown.label}.`}
      </p>
      <p role="status" className="sr-only">
        {countdown.ended ? 'Your stock hold has ended.' : `Your items are held for about ${Math.max(1, Math.round((expiresAt - now) / 60_000))} minutes.`}
      </p>
    </div>
  )
}
