'use client'

import { announceCartAdded } from '@/features/ecommerce/lib/miniCart'
import { useCart } from '@/engine/commerce/react'
import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { useDisplayMoney } from '@/components/DisplayCurrencyContext'
import type { CompositeStepView } from '@/features/ecommerce/server/composite'

export type CompositeView = { baseCents: number | null; steps: CompositeStepView[] }

/** Items that start picked: the ones marked default that are in stock, up to what each step allows. */
const startingPicks = (steps: CompositeStepView[]): Record<string, number[]> =>
  Object.fromEntries(steps.map((step) => [step.label, step.options.filter((option) => option.isDefault && option.available).slice(0, step.max).map((option) => option.productId)]))

/**
 * "Build your own kit" picker: one group per step (radio buttons when a step takes one item, tick boxes when it takes
 * several), the total updating as items are picked, then Add to cart. The server checks the picks, stock and price again.
 */
export function CompositePicker({ productId, view, disabled = false }: { productId: number; view: CompositeView; disabled?: boolean }) {
  const money = useDisplayMoney()
  const { addItem, isLoading } = useCart()
  const [picks, setPicks] = useState<Record<string, number[]>>(() => startingPicks(view.steps))
  const [qty, setQty] = useState(1)
  const [message, setMessage] = useState('')
  const [added, setAdded] = useState(false)

  const totalCents = useMemo(() => {
    if (view.baseCents === null) return null
    let total = view.baseCents
    for (const step of view.steps) for (const option of step.options) if ((picks[step.label] ?? []).includes(option.productId)) total += option.extraCents
    return total
  }, [view, picks])

  const missing = view.steps.find((step) => (picks[step.label] ?? []).length < step.min)

  const toggle = (step: CompositeStepView, productIdPicked: number) => {
    setAdded(false)
    setMessage('')
    setPicks((current) => {
      const now = current[step.label] ?? []
      if (step.max === 1) return { ...current, [step.label]: now.includes(productIdPicked) && !step.required ? [] : [productIdPicked] }
      if (now.includes(productIdPicked)) return { ...current, [step.label]: now.filter((id) => id !== productIdPicked) }
      if (now.length >= step.max) return current
      return { ...current, [step.label]: [...now, productIdPicked] }
    })
  }

  const add = async () => {
    setMessage('')
    if (missing) {
      setMessage(missing.min === 1 ? `Please choose an item for ${missing.label}.` : `Please choose at least ${missing.min} items for ${missing.label}.`)
      return
    }
    const composite = view.steps.flatMap((step) => (picks[step.label] ?? []).map((id) => ({ component: step.label, productId: id })))
    const failure = await addItem({ product: productId, composite }, Math.max(1, Math.min(99, Math.floor(qty) || 1)))
    if (failure) setMessage(failure)
    else {
      setAdded(true)
      announceCartAdded()
    }
  }

  return (
    <div>
      {totalCents !== null ? (
        <p className="mb-3 font-[family-name:var(--font-display)] text-[1.5rem]" aria-live="polite">
          {money(totalCents / 100)}
        </p>
      ) : null}
      {view.steps.map((step) => {
        const chosen = picks[step.label] ?? []
        const single = step.max === 1
        return (
          <fieldset key={step.label} className="mb-4 border-0 p-0">
            <legend className="mb-1 text-[0.8rem] uppercase tracking-[0.06em]">
              {step.label}
              {step.required ? '' : ' (optional)'}
              {!single ? ` - choose ${step.min === step.max ? step.max : `${step.min} to ${step.max}`}` : ''}
            </legend>
            {step.description ? <p className="mb-1 text-[0.85rem] opacity-70">{step.description}</p> : null}
            {step.options.map((option) => {
              const checked = chosen.includes(option.productId)
              const full = !single && !checked && chosen.length >= step.max
              return (
                <label key={option.productId} className="mb-1 flex items-center gap-2 text-[0.95rem]">
                  <input
                    type={single ? 'radio' : 'checkbox'}
                    name={`composite-${step.label}`}
                    checked={checked}
                    disabled={!option.available || full}
                    onChange={() => toggle(step, option.productId)}
                    onClick={() => (single && checked && !step.required ? toggle(step, option.productId) : undefined)}
                  />
                  <span>
                    {option.title}
                    {option.extraCents > 0 ? ` (+${money(option.extraCents / 100)})` : ''}
                    {!option.available ? ' - out of stock' : ''}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )
      })}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[0.8rem] uppercase tracking-[0.06em]">Quantity</span>
          <input type="number" min={1} max={99} className="w-20 border border-[var(--color-line)] p-2" value={qty} onChange={(event) => setQty(Number(event.target.value))} />
        </label>
        <button type="button" className="btn btn--primary" onClick={add} disabled={disabled || isLoading || totalCents === null}>
          {isLoading ? 'Adding...' : 'Add to cart'}
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
