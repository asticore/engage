'use client'

import React, { useEffect, useState } from 'react'

import { freeShippingProgress } from '@/features/ecommerce/lib/freeShipping'

/** "Spend $X more for free shipping" with a progress bar. Shows nothing when no free-shipping threshold is set. English only. */
export const FreeShippingBar: React.FC<{ subtotal: number | null | undefined; money: (value: number | null | undefined) => string }> = ({ subtotal, money }) => {
  const [threshold, setThreshold] = useState<number | null>(null)

  const [address, setAddress] = useState({ country: '', postcode: '' })

  // The destination typed into the cart estimate (same saved key), so the bar follows the shipping zone.
  useEffect(() => {
    const read = (): void => {
      try {
        const saved = JSON.parse(window.localStorage.getItem('engage-cart-estimate') ?? '{}') as { country?: string; postcode?: string }
        setAddress({ country: (saved.country ?? '').trim().toUpperCase(), postcode: (saved.postcode ?? '').trim() })
      } catch {
        // Private browsing: no destination.
      }
    }
    read()
    window.addEventListener('cart-estimate-changed', read)
    return () => window.removeEventListener('cart-estimate-changed', read)
  }, [])

  useEffect(() => {
    let live = true
    setThreshold(null)
    const query = address.country ? `?country=${encodeURIComponent(address.country)}${address.postcode ? `&postcode=${encodeURIComponent(address.postcode)}` : ''}` : ''
    fetch(`/api/shop-free-shipping${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { threshold?: number | null } | null) => {
        setThreshold(live && data && typeof data.threshold === 'number' ? data.threshold : null)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [address.country, address.postcode])

  if (threshold === null) return null
  const progress = freeShippingProgress(typeof subtotal === 'number' ? subtotal : 0, threshold)
  return (
    <div className="mb-6" data-testid="free-shipping-bar">
      <p role="status" className="m-0 mb-2">
        {progress.reached ? 'You have free shipping.' : `Spend ${money(progress.remaining)} more for free shipping.`}
      </p>
      <div role="progressbar" aria-label="Progress to free shipping" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="h-2 w-full overflow-hidden rounded bg-[var(--color-line)]">
        <div className="h-full bg-[var(--color-ink)]" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  )
}
