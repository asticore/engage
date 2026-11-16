import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { accountContext } from '@/features/accounts/session'
import { engineAccountCartStore, resolveAccountCart } from '@/features/ecommerce/server/accountCart'
import { GUEST_CART_COOKIE, parseGuestCookie } from '@/features/ecommerce/lib/guestCart'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * GET: the shop client's first call on every page load.
 * Signed out: `{ signedIn: false }`, and the client keeps using its guest cart.
 * Signed in: the account's one persistent cart (id and secret, for this person only). A guest cart that came with
 * the browser is merged into it first and its cookie is cleared, so a cart built before signing in or signing up
 * is not lost, and a cart built on a phone shows on the laptop.
 */
export async function GET(): Promise<Response> {
  const context = await accountContext()
  const user = context.user as { id?: number | string } | null
  const userId = Number(user?.id)
  if (!user || !Number.isFinite(userId)) return NextResponse.json({ signedIn: false }, { headers: noStore })
  try {
    const jar = await cookies()
    const guest = parseGuestCookie(jar.get(GUEST_CART_COOKIE)?.value)
    const result = await resolveAccountCart(engineAccountCartStore(context.engine as never), userId, guest)
    if (jar.get(GUEST_CART_COOKIE)) jar.delete({ name: GUEST_CART_COOKIE, path: '/' })
    return NextResponse.json({ signedIn: true, ...result }, { headers: noStore })
  } catch {
    // The shop falls back to the guest cart in the browser rather than breaking the page.
    return NextResponse.json({ signedIn: false }, { headers: noStore })
  }
}
