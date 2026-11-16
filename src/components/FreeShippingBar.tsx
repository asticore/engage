'use client'

import React, { useEffect, useState } from 'react'

import { freeShippingProgress } from '@/features/ecommerce/lib/freeShipping'

/** "Spend $X more for free shipping" with a progress bar. Shows nothing when no free-shipping threshold is set. English only. */
export const FreeShippingBar: React.FC<{ subtotal: number | null | undefined; money: (value: number | null | undefined) => string }> = ({ subtotal, money }) => {
  const [threshold, setThreshold] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/shop-free-shipping')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { threshold?: number | null } | null) => {
        if (live && data && typeof data.threshold === 'number') setThreshold(data.threshold)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [])

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
