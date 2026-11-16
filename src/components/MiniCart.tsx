'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { CartCrossSells } from '@/components/CartCrossSells'
import { CartEstimate } from '@/components/CartEstimate'
import { MiniCartLinesPart } from '@/components/CartParts'
import { useDisplayMoney } from '@/components/DisplayCurrencyContext'
import { FreeShippingBar } from '@/components/FreeShippingBar'
import { useCart } from '@/engine/commerce/react'
import { CART_ADDED_EVENT, DEFAULT_CART_UI, isCartHref, type CartUiSettings } from '@/features/ecommerce/lib/miniCart'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The slide-out drawer or dropdown cart (Task 28b). The admin picks what the cart button does in Shop settings.
 * It takes over any link to the cart page, so the header link, the cart button element and "view cart" all open it.
 * Focus is trapped while it is open, Escape closes it and focus returns to what opened it.
 */
export const MiniCart: React.FC = () => {
  const [settings, setSettings] = useState<CartUiSettings>(DEFAULT_CART_UI)
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const { cart } = useCart()
  const money = useDisplayMoney()
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    let live = true
    fetch('/api/shop-cart-ui')
      .then((r): Promise<unknown> => (r.ok ? r.json() : Promise.resolve(null)))
      .then((data: unknown) => {
        const s = data as CartUiSettings | null
        if (live && s && (s.action === 'drawer' || s.action === 'dropdown' || s.action === 'page')) setSettings(s)
      })
      .catch((): void => undefined)
    return () => {
      live = false
    }
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    opener.current?.focus()
  }, [])

  // Take over cart links and open after add to cart.
  useEffect(() => {
    if (settings.action === 'page') return
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
      const link = (event.target as HTMLElement | null)?.closest?.('a')
      if (!link || link.closest('[data-mini-cart]') || !isCartHref(link.getAttribute('href'))) return
      event.preventDefault()
      opener.current = link
      setOpen(true)
    }
    const onAdded = () => {
      if (!settings.openOnAdd) return
      opener.current = (document.activeElement as HTMLElement | null) ?? null
      setOpen(true)
    }
    document.addEventListener('click', onClick)
    window.addEventListener(CART_ADDED_EVENT, onAdded)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener(CART_ADDED_EVENT, onAdded)
    }
  }, [settings])

  // Focus into the panel, trap Tab, close on Escape.
  useEffect(() => {
    if (!open) return
    const el = panel.current
    ;(el?.querySelector<HTMLElement>('[data-mini-cart-close]') ?? el)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !el) return
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  const items = cart?.items ?? []
  const count = items.reduce((n, i) => n + (i.quantity || 0), 0)
  useEffect(() => {
    if (open) setAnnounce(`${count} ${count === 1 ? 'item' : 'items'} in your cart, subtotal ${money(cart?.subtotal)}`)
  }, [open, count, cart?.subtotal, money])

  if (settings.action === 'page' || !open) return null
  const drawer = settings.action === 'drawer'

  return (
    <div data-mini-cart data-mode={settings.action}>
      {drawer ? <div aria-hidden="true" className="fixed inset-0 z-[90] bg-black/40" onClick={close} /> : null}
      <div
        ref={panel}
        role="dialog"
        aria-modal={drawer ? 'true' : undefined}
        aria-label="Your cart"
        tabIndex={-1}
        className={
          drawer
            ? 'fixed bottom-0 right-0 top-0 z-[91] flex w-full max-w-[420px] flex-col overflow-y-auto bg-[var(--color-bg,#fff)] p-5 shadow-xl'
            : 'fixed right-4 top-16 z-[91] flex max-h-[80vh] w-[min(92vw,380px)] flex-col overflow-y-auto border border-[var(--color-line)] bg-[var(--color-bg,#fff)] p-4 shadow-xl'
        }
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 text-[1.1rem]">Your cart</h2>
          <button type="button" data-mini-cart-close onClick={close} aria-label="Close cart" className="cursor-pointer border-none bg-transparent text-[1.4rem] leading-none">
            ×
          </button>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
        {items.length === 0 ? (
          <MiniCartLinesPart onNavigate={() => setOpen(false)} />
        ) : (
          <>
            <MiniCartLinesPart />
            <FreeShippingBar subtotal={cart?.subtotal} money={money} />
            <CartEstimate compact />
            <CartCrossSells />
            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
              <p className="m-0">
                Subtotal: <strong>{money(cart?.subtotal)}</strong>
              </p>
              <Link href="/checkout" className="btn btn--primary" onClick={() => setOpen(false)}>
                Checkout
              </Link>
            </div>
            <p className="mt-3 text-center text-[0.85rem]">
              <Link href="/cart" data-mini-cart-skip onClick={() => setOpen(false)}>
                View full cart
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
