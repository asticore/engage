import { parseBrevoEvent, sameSecret } from '@/features/email/providerEvents'
import { recordProviderEvents } from '@/features/email/providerFeed'

export const dynamic = 'force-dynamic'

/**
 * Brevo transactional webhook (hard bounces, blocked and invalid addresses, spam reports). Brevo does not
 * sign its posts, so the URL carries the EMAIL_EVENTS_KEY secret, the same as the Postmark route:
 * POST /api/email-events/brevo?key=<EMAIL_EVENTS_KEY>. No key set, or a wrong one, gets 401.
 */
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.EMAIL_EVENTS_KEY ?? ''
  const given = new URL(request.url).searchParams.get('key') ?? ''
  if (!expected || !sameSecret(expected, given)) return new Response('Unauthorised.', { status: 401 })
  const body: unknown = await request.json().catch((): null => null)
  const recorded = await recordProviderEvents('brevo', parseBrevoEvent(body))
  return Response.json({ ok: true, recorded })
}
