import { parseMailgunEvent } from '@/features/email/providerEvents'
import { recordProviderEvents } from '@/features/email/providerFeed'
import { verifyMailgun } from '@/features/email/providerSignatures'

export const dynamic = 'force-dynamic'

/**
 * Mailgun webhook (bounces and complaints, JSON format). Signed: set MAILGUN_WEBHOOK_SIGNING_KEY to the
 * HTTP webhook signing key from Mailgun's API security page.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch((): null => null)) as { signature?: unknown; 'event-data'?: unknown } | null
  const signature = body?.signature as Parameters<typeof verifyMailgun>[0]
  if (!(await verifyMailgun(signature, process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? ''))) {
    return new Response('Unauthorised.', { status: 401 })
  }
  const recorded = await recordProviderEvents('mailgun', parseMailgunEvent(body?.['event-data']))
  return Response.json({ ok: true, recorded })
}
