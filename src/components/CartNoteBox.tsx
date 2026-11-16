'use client'

import React, { useEffect, useId, useState } from 'react'

import { CART_NOTE_KEY, EMPTY_NOTE, GIFT_MAX, NOTE_MAX, parseCartNote, type CartNote } from '@/features/ecommerce/lib/cartNote'

/** Order note and gift message on the cart page. Shown only when the Order notes checkout field is on. English only. */
export const CartNoteBox: React.FC = () => {
  const uid = useId()
  const [available, setAvailable] = useState(false)
  const [value, setValue] = useState<CartNote>(EMPTY_NOTE)

  useEffect(() => {
    let live = true
    try {
      setValue(parseCartNote(window.localStorage.getItem(CART_NOTE_KEY)))
    } catch {
      // Private browsing: starts empty.
    }
    fetch('/api/shop-checkout-fields')
      .then((r): Promise<unknown> => (r.ok ? r.json() : Promise.resolve(null)))
      .then((d: unknown) => {
        if (live) setAvailable((d as { orderNotes?: boolean } | null)?.orderNotes === true)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [])

  function update(next: CartNote): void {
    setValue(next)
    try {
      window.localStorage.setItem(CART_NOTE_KEY, JSON.stringify(next))
    } catch {
      // Not saved.
    }
  }

  if (!available) return null
  return (
    <div className="mb-6 grid max-w-md gap-3">
      <label className="grid gap-1 text-[0.85rem]" htmlFor={`${uid}-note`}>
        Order note
        <textarea id={`${uid}-note`} rows={3} maxLength={NOTE_MAX} value={value.note} onChange={(e) => update({ ...value, note: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-[0.85rem]">
        <input type="checkbox" checked={value.gift} onChange={(e) => update({ ...value, gift: e.target.checked })} />
        This order is a gift
      </label>
      {value.gift ? (
        <label className="grid gap-1 text-[0.85rem]" htmlFor={`${uid}-gift`}>
          Gift message
          <textarea id={`${uid}-gift`} rows={2} maxLength={GIFT_MAX} value={value.giftMessage} onChange={(e) => update({ ...value, giftMessage: e.target.value })} />
        </label>
      ) : null}
      <p className="m-0 text-[0.8rem] opacity-70">This goes into the order notes at checkout, where you can still change it.</p>
    </div>
  )
}
