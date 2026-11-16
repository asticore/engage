'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { useCart } from '@/engine/commerce/react'
import { addSaved, parseSaved, removeSaved, SAVED_KEY, type SavedLine } from '@/features/ecommerce/lib/savedForLater'

function read(): SavedLine[] {
  try {
    return parseSaved(window.localStorage.getItem(SAVED_KEY))
  } catch {
    return []
  }
}
function write(list: SavedLine[]): void {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(list))
  } catch {
    // Private browsing: kept for this page view only.
  }
}

/** Hook for the cart page: the saved lines, plus save and move back. */
export function useSavedForLater() {
  const { addItem } = useCart()
  const [saved, setSaved] = useState<SavedLine[]>([])
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => setSaved(read()), [])
  const save = useCallback((line: SavedLine) => {
    setSaved((prev) => {
      const next = addSaved(prev, line)
      write(next)
      return next
    })
  }, [])
  const moveBack = useCallback(
    async (index: number) => {
      const line = saved[index]
      if (!line) return
      setMessage(null)
      const failure = await addItem({ product: line.product, variation: line.variation }, line.quantity)
      if (failure) {
        setMessage(`${line.title}: ${failure}`)
        return
      }
      const next = removeSaved(saved, index)
      setSaved(next)
      write(next)
    },
    [saved, addItem],
  )
  const discard = useCallback(
    (index: number) => {
      const next = removeSaved(saved, index)
      setSaved(next)
      write(next)
    },
    [saved],
  )
  return { saved, save, moveBack, discard, message }
}

export const SavedForLaterList: React.FC<{ saved: SavedLine[]; moveBack: (i: number) => Promise<void>; discard: (i: number) => void; message: string | null }> = ({ saved, moveBack, discard, message }) => {
  if (saved.length === 0 && !message) return null
  return (
    <section aria-labelledby="saved-heading" className="mt-8">
      <h2 id="saved-heading" className="text-[1.1rem]">
        Saved for later ({saved.length})
      </h2>
      <p role="status" aria-live="polite" className="text-[#b3261e]">
        {message}
      </p>
      <ul className="m-0 list-none border-t border-[var(--color-line)] p-0">
        {saved.map((line, i) => (
          <li key={`${line.product}-${line.variation ?? ''}-${i}`} className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] py-3">
            <span>
              {line.title}
              {line.note ? <span className="block text-[0.85rem] opacity-70">{line.note}</span> : null}
              <span className="block text-[0.85rem] opacity-70">Quantity {line.quantity}</span>
            </span>
            <span className="flex gap-3">
              <button type="button" className="btn" onClick={() => void moveBack(i)} aria-label={`Move ${line.title} back to cart`}>
                Move to cart
              </button>
              <button type="button" className="cursor-pointer border-none bg-transparent text-[0.85rem] underline" onClick={() => discard(i)} aria-label={`Delete saved ${line.title}`}>
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
