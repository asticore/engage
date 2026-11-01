import { parseSendgridEvents } from '@/features/email/providerEvents'
import { recordProviderEvents } from '@/features/email/providerFeed'
import { verifySendgrid } from '@/features/email/providerSignatures'

export const dynamic = 'force-dynamic'

/**
 * SendGrid Event Webhook (bounces and spam reports). Signed with ECDSA: set SENDGRID_WEBHOOK_PUBLIC_KEY to
 * the verification key shown under Mail Settings > Event Webhook > Signed Event Webhook Requests.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp') ?? ''
  const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature') ?? ''
  if (!(await verifySendgrid(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ?? '', timestamp, rawBody, signature))) {
    return new Response('Unauthorised.', { status: 401 })
  }
  let body: unknown = null
  try {
    body = JSON.parse(rawBody)
  } catch {
    body = null
  }
  const recorded = await recordProviderEvents('sendgrid', parseSendgridEvents(body))
  return Response.json({ ok: true, recorded })
}
