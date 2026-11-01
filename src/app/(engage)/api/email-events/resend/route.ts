import { parseResendEvent } from '@/features/email/providerEvents'
import { recordProviderEvents } from '@/features/email/providerFeed'
import { verifyResend } from '@/features/email/providerSignatures'

export const dynamic = 'force-dynamic'

/**
 * Resend webhook (bounces and complaints). Signed with Svix: set RESEND_WEBHOOK_SECRET to the signing
 * secret shown when the endpoint is added in Resend. A post with a missing or wrong signature gets 401.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  if (!(await verifyResend(request.headers, rawBody, process.env.RESEND_WEBHOOK_SECRET ?? ''))) {
    return new Response('Unauthorised.', { status: 401 })
  }
  const recorded = await recordProviderEvents('resend', parseResendEvent(safeJson(rawBody)))
  return Response.json({ ok: true, recorded })
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
