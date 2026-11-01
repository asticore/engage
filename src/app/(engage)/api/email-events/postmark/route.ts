import { suppressAddress } from '@/features/email/suppression'
import { parsePostmarkEvent, sameSecret } from '@/features/email/providerEvents'

export const dynamic = 'force-dynamic'

/**
 * Postmark webhook for bounces, spam complaints and provider suppressions.
 * Postmark calls `POST /api/email-events/postmark?key=<EMAIL_EVENTS_KEY>`. The key is a
 * separate secret so the URL can be pasted into Postmark without exposing ENGAGE_SECRET.
 * Without the key set, or with a wrong one, nothing is recorded (401).
 *
 * Every other record, and a record that cannot be read, gets a 200: Postmark retries
 * any other status, and there is nothing to retry.
 */
export async function POST(request: Request): Promise<Response> {
  const expected = process.env.EMAIL_EVENTS_KEY ?? ''
  const given = new URL(request.url).searchParams.get('key') ?? ''
  if (!expected || !sameSecret(expected, given)) return new Response('Unauthorised.', { status: 401 })

  const body: unknown = await request.json().catch((): null => null)
  const event = parsePostmarkEvent(body)
  if (!event) return Response.json({ ok: true, recorded: false })

  const recorded = await suppressAddress(event.address, event.reason, `postmark:${event.type}`)
  return Response.json({ ok: true, recorded })
}
