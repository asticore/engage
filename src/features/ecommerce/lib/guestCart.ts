/**
 * Guest carts and the account cart: the pure parts.
 *
 * A visitor who is not signed in has a guest cart (id plus secret, kept in the browser). The server also keeps
 * that pair in an HttpOnly cookie, so that whichever way the visitor signs in or signs up, the next page load
 * can fold the guest cart into the account's own cart. These helpers have no I/O: the cookie format, the line
 * merge, and the age after which an untouched guest cart is swept.
 */

export const GUEST_CART_COOKIE = 'eg_guest_cart'
/** Guest carts nobody has touched for this long are deleted. The cookie lives as long. */
export const GUEST_CART_DAYS = 30
export const GUEST_CART_MAX_AGE_SECONDS = GUEST_CART_DAYS * 24 * 60 * 60

export type GuestCartRef = { id: number; secret: string }

export type CartLine = {
  id?: string
  product?: number | { id: number } | null
  variation?: string | null
  quantity?: number | null
  priceCents?: number | null
  customAmount?: number | null
  giftName?: string | null
  addOns?: string | null
  [key: string]: unknown
}

export const formatGuestCookie = (ref: GuestCartRef): string => `${ref.id}.${ref.secret}`

/** Reads the cookie value. Anything that is not `<positive integer>.<hex secret>` is ignored. */
export const parseGuestCookie = (value: string | null | undefined): GuestCartRef | null => {
  if (!value) return null
  const match = /^(\d{1,12})\.([0-9a-f]{16,128})$/i.exec(value)
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 ? { id, secret: match[2] } : null
}

const productIdOf = (line: CartLine): number | null =>
  line.product && typeof line.product === 'object' ? line.product.id : typeof line.product === 'number' ? line.product : null

/** Lines that are the same purchase add up; a gift card or a name-your-price line always stays its own line. */
const sameLine = (a: CartLine, b: CartLine): boolean =>
  a.customAmount == null &&
  b.customAmount == null &&
  !a.giftName &&
  !b.giftName &&
  productIdOf(a) !== null &&
  productIdOf(a) === productIdOf(b) &&
  (a.variation || null) === (b.variation || null) &&
  (a.priceCents ?? null) === (b.priceCents ?? null) &&
  (a.addOns || null) === (b.addOns || null)

/** Adds one guest line into the account lines: same purchase adds quantities, otherwise it is appended without the guest row id. */
export const mergeLine = (target: CartLine[], line: CartLine): CartLine[] => {
  const index = target.findIndex((existing) => sameLine(existing, line))
  if (index !== -1) {
    const copy = [...target]
    copy[index] = { ...copy[index], quantity: (copy[index].quantity ?? 0) + (line.quantity ?? 0) }
    return copy
  }
  const { id: _omit, ...rest } = line
  return [...target, rest]
}

export const mergeCartLines = (target: CartLine[], source: CartLine[]): CartLine[] => source.reduce(mergeLine, target)
