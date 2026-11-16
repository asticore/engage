import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { getEngine } from '@/lib/engine'
import { engineAccountCartStore } from '@/features/ecommerce/server/accountCart'
import { GUEST_CART_COOKIE, GUEST_CART_MAX_AGE_SECONDS, formatGuestCookie, parseGuestCookie } from '@/features/ecommerce/lib/guestCart'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * POST { id, secret }: remembers this browser's guest cart in an HttpOnly cookie, so a later sign-in or sign-up
 * can merge it into the account. The pair is checked against the cart first; a wrong pair sets nothing.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = (await headers()).get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return NextResponse.json({ ok: false }, { status: 403, headers: noStore })
    } catch {
      return NextResponse.json({ ok: false }, { status: 403, headers: noStore })
    }
  }
  const body = (await request.json().catch((): null => null)) as { id?: unknown; secret?: unknown } | null
  const ref = parseGuestCookie(`${Number(body?.id)}.${typeof body?.secret === 'string' ? body.secret : ''}`)
  if (!ref) return NextResponse.json({ ok: false }, { status: 400, headers: noStore })
  const cart = await engineAccountCartStore((await getEngine()) as never).findGuest(ref)
  if (!cart) return NextResponse.json({ ok: false }, { status: 404, headers: noStore })
  const jar = await cookies()
  if (jar.get(GUEST_CART_COOKIE)?.value !== formatGuestCookie(ref)) {
    jar.set(GUEST_CART_COOKIE, formatGuestCookie(ref), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: GUEST_CART_MAX_AGE_SECONDS,
    })
  }
  return NextResponse.json({ ok: true }, { headers: noStore })
}
