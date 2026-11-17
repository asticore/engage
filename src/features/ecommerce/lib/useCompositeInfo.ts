'use client'

import { useEffect, useState } from 'react'

export type CompositeInfo = { priceCents: number | null; available: boolean; summary: string }
export type CompositeLineRef = { key: string; productId: number; composite: string | null | undefined }

/** What the cart shows for each kit line (price, availability, picks), from /api/shop-composites. Empty until loaded. */
export function useCompositeInfo(lines: CompositeLineRef[]): Record<string, CompositeInfo> {
  const payload = JSON.stringify(lines)
  const [result, setResult] = useState<{ payload: string; data: Record<string, CompositeInfo> } | null>(null)

  useEffect(() => {
    if (payload === '[]') return
    let active = true
    fetch('/api/shop-composites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: JSON.parse(payload) }) })
      .then((res): Promise<unknown> => (res.ok ? res.json() : Promise.resolve({})))
      .then((data: unknown) => {
        if (active) setResult({ payload, data: data && typeof data === 'object' ? (data as Record<string, CompositeInfo>) : {} })
      })
      .catch(() => {
        if (active) setResult({ payload, data: {} })
      })
    return () => {
      active = false
    }
  }, [payload])

  return payload !== '[]' && result?.payload === payload ? result.data : {}
}
