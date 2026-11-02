'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { useCart } from '@/engine/commerce/react'

import { usePortalText } from './PortalText'

/** Adds every line of a past order to the cart again (current prices and stock apply at checkout). */
export const ReorderButton: React.FC<{ items: { product: number; quantity: number }[] }> = ({ items }) => {
  const { addItem } = useCart()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const t = usePortalText()
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={busy || items.length === 0}
        onClick={async () => {
          setBusy(true)
          setFailed(false)
          try {
            for (const item of items) await addItem({ product: item.product }, item.quantity)
            router.push('/cart')
          } catch {
            // The lines already added stay in the cart; the customer can press again.
            setFailed(true)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? t('orders.adding') : t('orders.orderAgain')}
      </button>
      {failed ? (
        <p className="account-note account-note--error" role="alert">
          {t('orders.reorderFailed')}
        </p>
      ) : null}
    </>
  )
}
