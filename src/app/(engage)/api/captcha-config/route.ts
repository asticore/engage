import { NextResponse } from 'next/server'

import { getEngine } from '@/engine'
import { authCaptchaConfig } from '@/features/security/authCaptcha'
import { isPlaceId } from '@/features/security/captchaPlaces'

export const dynamic = 'force-dynamic'

/**
 * GET ?place=signIn: whether this visitor must pass the CAPTCHA at that place right now, and the public site key to draw it
 * with. The answer depends on the place's mode, the visitor's recent failures and their Cloudflare bot score, so it is
 * never cached. Secret keys are never returned.
 */
export async function GET(request: Request): Promise<Response> {
  const place = new URL(request.url).searchParams.get('place')
  const headers = { 'Cache-Control': 'no-store' }
  if (!isPlaceId(place)) return NextResponse.json({ captcha: null }, { status: 400, headers })
  const captcha = await authCaptchaConfig((await getEngine()) as never, place, undefined, request.headers.get('cf-connecting-ip') ?? undefined)
  return NextResponse.json({ captcha }, { headers })
}
