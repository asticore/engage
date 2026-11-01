import { parseMandrillEvents } from '@/features/email/providerEvents'
import { recordProviderEvents } from '@/features/email/providerFeed'
import { verifyMandrill } from '@/features/email/providerSignatures'

export const dynamic = 'force-dynamic'

/**
 * Mandrill webhook (hard bounces and spam reports). Signed: set MANDRILL_WEBHOOK_KEY to the key Mandrill
 * shows for the webhook. The signature covers the full URL, so the webhook URL in Mandrill must be the
 * exact address of this route, with its `key` if one is used.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch((): null => null)
  if (!form) return new Response('Unauthorised.', { status: 401 })
  const fields: Record<string, string> = {}
  for (const [name, value] of form.entries()) if (typeof value === 'string') fields[name] = value
  const given = request.headers.get('X-Mandrill-Signature') ?? ''
  if (!(await verifyMandrill(request.url, fields, process.env.MANDRILL_WEBHOOK_KEY ?? '', given))) {
    return new Response('Unauthorised.', { status: 401 })
  }
  let events: unknown = []
  try {
    events = JSON.parse(fields.mandrill_events ?? '[]')
  } catch {
    events = []
  }
  const recorded = await recordProviderEvents('mandrill', parseMandrillEvents(events))
  return Response.json({ ok: true, recorded })
}
