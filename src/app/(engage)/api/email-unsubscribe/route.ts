import { resolveD1Binding } from '@/cms/db/connect'
import { isMissingFeatureTable } from '@/localapi/missingFeatureTable'
import { suppressAddress } from '@/features/email/suppression'
import { verifyUnsubscribeToken } from '@/features/email/unsubscribe'

export const dynamic = 'force-dynamic'

/**
 * One-click unsubscribe for reminder and marketing mail (see src/features/email/unsubscribe.ts).
 *
 * GET shows a confirm button and changes nothing, so a mail scanner that follows
 * links cannot unsubscribe someone. POST does it: this is the button on the page,
 * and also the one-click request that mail clients send from the List-Unsubscribe-Post header.
 */

const page = (title: string, message: string, status = 200, form = ''): Response =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;line-height:1.5;max-width:36rem;margin:3rem auto;padding:0 16px"><h1 style="font-size:1.4rem">${title}</h1><p>${message}</p>${form}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )

async function handle(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('t') ?? ''
  const email = await verifyUnsubscribeToken(process.env.ENGAGE_SECRET ?? '', token)
  if (!email) return page('This link is not valid', 'The link may be incomplete or damaged. Use the newest email you received, or ask the sender to send it again.', 400)

  if (request.method === 'GET') {
    const action = `${new URL(request.url).pathname}?t=${encodeURIComponent(token)}`
    return page(
      'Unsubscribe',
      `Stop reminder and marketing emails to ${escapeText(email)}?`,
      200,
      `<form method="post" action="${escapeAttribute(action)}"><button type="submit" style="font:inherit;padding:.5rem 1rem;cursor:pointer">Unsubscribe</button></form>`,
    )
  }

  await suppressAddress(email, 'unsubscribed', 'link')
  const d1 = await resolveD1Binding()
  // Keep the abandoned-cart switch in step, so cart reminders stop for this address too.
  // No shop tables on a site where the shop has never been switched on: nothing to keep in step.
  await d1.prepare('UPDATE eg_carts SET unsubscribed = 1 WHERE lower(email) = ?').bind(email).run().catch((error: unknown) => {
    if (!isMissingFeatureTable(error)) throw error
  })
  return page('You are unsubscribed', 'You will not get any more reminder or marketing emails from this site. Emails about orders, bookings and sign-in still arrive.')
}

const escapeText = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttribute = (value: string): string => escapeText(value).replace(/"/g, '&quot;')

export const GET = handle
export const POST = handle
