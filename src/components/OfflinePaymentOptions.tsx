'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { CheckoutInput } from '@/components/CheckoutExtras'

/** Bank transfer, cheque or cash on delivery, when the shop has switched them on. Renders nothing otherwise. */
type Cart = { id: number; secret: string }
type Option = { id: string; label: string; instructions: string }

let offlineConfig: Promise<Option[]> | null = null

/** One request per page view. Only the methods that are switched on come back. */
function loadOffline(): Promise<Option[]> {
  if (!offlineConfig) {
    offlineConfig = fetch('/api/shop-payment-config')
      .then((res) => (res.ok ? (res.json() as Promise<{ offline?: Option[] }>) : null))
      .then((json) => (Array.isArray(json?.offline) ? json.offline.filter((o) => o && typeof o.id === 'string') : []))
      .catch((): Option[] => [])
  }
  return offlineConfig
}

/**
 * "Pay another way": the customer picks a method and places the order. The server prices the cart and saves the
 * order as Pending payment; the instructions are shown here and sent by email. Nothing is charged to a card.
 */
export const OfflinePaymentOptions: React.FC<{ cartRef: Cart | null; email: string; extras: CheckoutInput | null }> = ({ cartRef, email, extras }) => {
  const router = useRouter()
  const [options, setOptions] = useState<Option[]>([])
  const [chosen, setChosen] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadOffline().then((list) => {
      if (alive) setOptions(list)
    })
    return () => {
      alive = false
    }
  }, [])

  if (options.length === 0) return null
  const current = options.find((o) => o.id === chosen) ?? options[0]

  const place = async () => {
    setError(null)
    if (!cartRef) return setError('Your cart is empty.')
    if (!email) return setError('Please enter your email address first.')
    setBusy(true)
    try {
      const res = await fetch('/api/shop-offline-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartID: cartRef.id,
          secret: cartRef.secret,
          method: current.id,
          customerEmail: email,
          shippingAddress: extras?.address,
          billingAddress: extras?.address,
          couponCode: extras?.couponCode,
          shippingOptionId: extras?.shippingOptionId,
          checkoutFields: extras?.checkoutFields,
          giftCardCodes: extras?.giftCardCodes,
          useStoreCredit: extras?.useStoreCredit,
        }),
      })
      const json = (await res.json().catch((): Record<string, unknown> => ({}))) as { orderID?: number; error?: string }
      if (!res.ok) throw new Error(json.error || 'The order could not be placed.')
      router.push(`/checkout/success${json.orderID ? `?order=${json.orderID}` : ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The order could not be placed.')
      setBusy(false)
    }
  }

  return (
    <fieldset className="flex flex-col gap-2 border border-[var(--color-line)] p-3">
      <legend className="px-1 text-[0.85rem] uppercase tracking-[0.06em]">Or pay another way</legend>
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2">
          <input type="radio" name="offline-method" value={o.id} checked={current.id === o.id} onChange={() => setChosen(o.id)} />
          {o.label}
        </label>
      ))}
      {current.instructions && <p className="m-0 whitespace-pre-wrap text-[0.9rem] opacity-80">{current.instructions}</p>}
      {error && <p className="form-error">{error}</p>}
      <button type="button" className="btn" onClick={place} disabled={busy}>
        {busy ? 'Placing order...' : `Place order to pay by ${current.label.toLowerCase()}`}
      </button>
    </fieldset>
  )
}
