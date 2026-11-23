'use client'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { useCart } from '@/engine/commerce/react'
import { validateNamedPrice } from '@/features/ecommerce/lib/qtyLimits'

import { num, str } from './elementUtil'
import './wave72.css'

/** Wave 72 client elements (Task 10, 29d): the Pay button. Defs: wave72Defs.ts. No payment code: it uses the cart and /checkout. */

type P = Record<string, unknown>

/** Whole units typed by the buyer to cents, or null when it is not a number. */
export function toCents(v: string | number): number | null {
  const n = typeof v === 'number' ? v : Number(v.trim())
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** The line to add for the given props and typed amount, or the reason it cannot be added. */
export function payLine(props: P, typed: string): { ok: true; product: number; quantity: number; priceCents?: number } | { ok: false; error: string } {
  const product = Math.floor(num(props.productId, 0, 0))
  if (!product) return { ok: false, error: 'Choose a product for this button.' }
  const quantity = Math.floor(num(props.quantity, 1, 1, 99))
  if (props.askAmount !== true) return { ok: true, product, quantity }
  const cents = toCents(typed)
  const minCents = toCents(num(props.minAmount, 0, 0)) ?? 0
  const check = validateNamedPrice(cents, { minPrice: minCents })
  if (!check.ok || check.cents === null) return { ok: false, error: check.error ?? 'Please enter an amount.' }
  return { ok: true, product, quantity, priceCents: check.cents }
}

export function PayButtonElement(props: P): React.ReactElement {
  const { addItem, isLoading } = useCart()
  const router = useRouter()
  const [typed, setTyped] = useState(props.amount != null && props.amount !== '' ? String(props.amount) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ask = props.askAmount === true
  const click = async () => {
    const line = payLine(props, typed)
    if (line.ok === false) { setError(line.error); return }
    setError('')
    setBusy(true)
    const failure = await addItem(line.priceCents != null ? { product: line.product, priceCents: line.priceCents } : { product: line.product }, line.quantity)
    setBusy(false)
    if (failure) { setError(failure); return }
    router.push('/checkout')
  }
  return (
    <div className="w72-pay">
      {ask && (
        <label className="w72-amount">
          <span>Amount</span>
          <input type="number" inputMode="decimal" min={0} step="0.01" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
      )}
      <button type="button" className="btn btn--primary" onClick={click} disabled={isLoading || busy}>
        {busy ? 'One moment...' : str(props.label) || 'Buy now'}
      </button>
      <span role="alert" className="w72-error">{error}</span>
    </div>
  )
}

export const WAVE72_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'pay-button': PayButtonElement,
}
