/**
 * Mini cart (Task 28b). The admin chooses what the cart button and add to cart do: go to the cart page,
 * open a slide-out drawer, or open a dropdown. Add to cart buttons call `announceCartAdded()`; the mini cart
 * listens, so no button needs to know which one is chosen.
 */

export type CartAction = 'page' | 'drawer' | 'dropdown'
export type CartUiSettings = { action: CartAction; openOnAdd: boolean }

export const DEFAULT_CART_UI: CartUiSettings = { action: 'page', openOnAdd: true }
export const CART_ADDED_EVENT = 'engage:cart-added'

export function normaliseCartUi(doc: unknown): CartUiSettings {
  const d = (doc ?? {}) as { cartAction?: unknown; cartOpenOnAdd?: unknown }
  const action: CartAction = d.cartAction === 'drawer' || d.cartAction === 'dropdown' ? d.cartAction : 'page'
  return { action, openOnAdd: d.cartOpenOnAdd !== false }
}

/** True for a link that goes to the cart page (also on a locale prefixed path such as /fr/cart). */
export function isCartHref(href: string | null | undefined): boolean {
  if (!href) return false
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '')
  return /^(\/[a-z]{2}(-[A-Za-z]+)?)?\/cart$/.test(path)
}

export function announceCartAdded(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_ADDED_EVENT))
}
