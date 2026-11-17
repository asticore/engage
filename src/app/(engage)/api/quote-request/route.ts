import { NextResponse } from 'next/server'

import { checkQuoteFiles, getQuoteBucket, storeQuoteFiles, type PendingQuoteFile } from '@/features/quotes/attachments'
import { resolveUploadPolicy } from '@/features/media/fileTypes'
import { rawD1 } from '@/features/ecommerce/server/db'
import { bidRefusal, parseRequest, newQuoteNumber } from '@/features/quotes/logic'
import { getEngineSafe, sendQuoteEmail } from '@/features/quotes/service'
import * as store from '@/features/quotes/store'
import { loadShopCurrency } from '@/features/ecommerce/lib/shopCurrency'
import { hitShared } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** POST { kind, name, email, phone?, quantity?, details?, deadline?, offer?, productId?, pageUrl? }: saves a request and tells the customer and the shop. */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).quotes) return json({ error: 'Not found' }, 404)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
  if ((await hitShared(`quote-request:${ip}`, 8)).limited) return json({ error: 'Too many requests from this connection. Try again later.' }, 429)
  // JSON, or multipart when the customer attached files.
  let body: Record<string, unknown> | null = null
  const pending: PendingQuoteFile[] = []
  if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await request.formData().catch((): null => null)
    if (form) {
      body = {}
      for (const [key, value] of form.entries()) {
        if (typeof value === 'string') body[key] = value
        else if (key === 'files' && value.size > 0 && pending.length <= 5) pending.push({ name: value.name, type: value.type, size: value.size, data: new Uint8Array(await value.arrayBuffer()) })
      }
    }
  } else {
    body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  }
  if (!body) return json({ error: 'Send the details.' }, 400)
  if (typeof body.website === 'string' && body.website) return json({ ok: true }) // a hidden field only bots fill in
  const parsed = parseRequest(body)
  if (parsed.ok === false) return json({ error: parsed.error }, 400)
  const d1 = (await rawD1()) as never as store.D1
  if (parsed.value.kind === 'bid' && parsed.value.productId) {
    const terms = await store.productBidTerms(d1, parsed.value.productId).catch((): null => null)
    const refusal = terms ? bidRefusal(terms, parsed.value.offerCents, new Date()) : null
    if (refusal) return json({ error: refusal }, 409)
  }
  const engine = await getEngineSafe()
  // Files are checked before anything is saved, so a refused file makes no request.
  let checked: ReturnType<typeof checkQuoteFiles> | null = null
  if (pending.length > 0) {
    const policy = resolveUploadPolicy(await (engine as never as { findGlobal: (a: { slug: string; depth: number }) => Promise<unknown> }).findGlobal({ slug: 'media-settings', depth: 0 }).catch((): null => null))
    checked = checkQuoteFiles(pending, policy)
    if ('error' in checked) return json({ error: checked.error }, 400)
  }
  const currency = await loadShopCurrency(engine as never).catch(() => 'AUD')
  const saved = await store.createRequest(d1, newQuoteNumber(), parsed.value, currency, new Date().toISOString())
  if (!saved) return json({ error: 'We could not save that. Please try again.' }, 500)
  if (checked && 'ok' in checked) {
    await storeQuoteFiles(await getQuoteBucket(), saved.number, checked.ok).catch((error: unknown) => {
      console.error('quote-request: attachments could not be stored', error)
    })
  }
  await sendQuoteEmail(engine, 'received', saved, { to: 'customer' })
  await sendQuoteEmail(engine, 'adminNew', saved, { to: 'admin' })
  return json({ ok: true, number: saved.number })
}
