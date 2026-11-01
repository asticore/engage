import { parseSesMessage } from '@/features/email/providerEvents'
import { recordProviderEvents } from '@/features/email/providerFeed'
import { isSnsUrl, verifySnsMessage } from '@/features/email/providerSignatures'

export const dynamic = 'force-dynamic'

/**
 * Amazon SES bounces and complaints, delivered by an SNS topic that the SES configuration set publishes to.
 * SNS signs every message, so there is no secret here: the signature is checked against the AWS certificate
 * in the message. The first post is a SubscriptionConfirmation, which is confirmed by fetching its
 * SubscribeURL (AWS hosts only). A message with a bad signature gets 403, so SNS does not treat it as delivered.
 */
export async function POST(request: Request): Promise<Response> {
  const text = await request.text()
  let message: Record<string, unknown> = {}
  try {
    message = JSON.parse(text) as Record<string, unknown>
  } catch {
    return new Response('Not a notification.', { status: 400 })
  }
  if (!(await verifySnsMessage(message))) return new Response('Signature not valid.', { status: 403 })

  if (message.Type === 'SubscriptionConfirmation' && isSnsUrl(message.SubscribeURL)) {
    await fetch(message.SubscribeURL, { redirect: 'error' }).catch((): null => null)
    return Response.json({ ok: true, confirmed: true })
  }
  if (message.Type !== 'Notification' || typeof message.Message !== 'string') return Response.json({ ok: true, recorded: 0 })

  let inner: unknown = null
  try {
    inner = JSON.parse(message.Message)
  } catch {
    inner = null
  }
  const recorded = await recordProviderEvents('ses', parseSesMessage(inner))
  return Response.json({ ok: true, recorded })
}
