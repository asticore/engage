import { NextResponse } from 'next/server'

import { AiError } from '@/features/ai/client'
import { aiKeyAvailability, readAiKey } from '@/features/ai/keys'
import { AI_PROVIDERS, type AiProvider } from '@/features/ai/models'
import { suggestTags } from '@/features/ai/tagSuggest'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { loadMedia, parseIdList, readJsonBody, type MediaEngine } from '@/features/media/store'
import { pathOf } from '@/features/mediaTags/logic'
import * as store from '@/features/mediaTags/store'
import { readMediaObject } from '@/localapi/storage'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** Most pictures one request may tag. Each one is a paid model call. */
const MAX_PER_REQUEST = 25
/** Most tags listed in the prompt. Keeps the call small on sites with huge tag trees. */
const MAX_TAGS_IN_PROMPT = 200
/** Formats the providers can read. SVG and GIF are left alone. */
const READABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

type ItemResult = { id: number; status: 'suggested' | 'tagged' | 'skipped' | 'failed'; tagIds?: number[]; reason?: string }

async function guard(write: boolean, request: Request): Promise<Response | null> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
  }
  const auth = await authorizeMedia('update')
  if (!auth.context) return auth.response
  if (!(await getFeatureFlags()).mediatags) return json({ error: 'Switch Media tags on in Site Settings first.' }, 409)
  return null
}

/** GET: which providers have a key, so the UI can pick a default. Presence only. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(false, request)
  if (denied) return denied
  return json({ providers: await aiKeyAvailability() })
}

/**
 * POST /api/admin-media-ai-tags  { ids, provider, apply? }
 *
 * Asks a vision model which of the site's EXISTING tags fit each picture. It never creates tags.
 * With apply true the tags are added to the file (nothing is ever removed); otherwise the
 * suggestions are only returned so the admin can tick them. Each picture succeeds or fails on its own.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(true, request)
  if (denied) return denied
  const auth = await authorizeMedia('update')
  if (!auth.context) return auth.response

  const body = await readJsonBody(request)
  if (!body) return json({ error: 'Send JSON with ids and a provider.' }, 400)
  const ids = parseIdList(body.ids, MAX_PER_REQUEST)
  if (!ids) return json({ error: `Choose between 1 and ${MAX_PER_REQUEST} pictures.` }, 400)
  const provider = body.provider as AiProvider
  if (!AI_PROVIDERS.includes(provider)) return json({ error: 'Choose Claude or OpenAI.' }, 400)
  const apply = body.apply === true

  const apiKey = await readAiKey(provider).catch((): null => null)
  if (!apiKey) return json({ error: `No ${provider === 'claude' ? 'Claude' : 'OpenAI'} API key is set in Integrations.` }, 400)

  const d1 = (await rawD1()) as never as store.D1
  const tags = await store.listTags(d1)
  if (tags.length === 0) return json({ error: 'Add some tags first. AI only picks from tags you already have.' }, 400)
  const choices = tags.map((t) => ({ id: t.id, path: pathOf(tags, t.id) })).slice(0, MAX_TAGS_IN_PROMPT)

  const engine = auth.context.engine as unknown as MediaEngine
  const tag = async (id: number): Promise<ItemResult> => {
    const doc = await loadMedia(engine, id)
    if (!doc) return { id, status: 'failed', reason: 'This picture no longer exists.' }
    if (!doc.filename || !doc.mimeType || !READABLE.has(doc.mimeType)) return { id, status: 'skipped', reason: 'Tags can only be suggested for JPEG, PNG and WebP pictures.' }
    try {
      const stored = await readMediaObject(doc.filename)
      if (!stored) return { id, status: 'failed', reason: 'The file is missing from storage.' }
      const tagIds = await suggestTags(provider, { data: stored.data, mimeType: doc.mimeType }, choices, apiKey)
      if (tagIds.length === 0) return { id, status: 'skipped', reason: 'No tag fits this picture.' }
      if (!apply) return { id, status: 'suggested', tagIds }
      await store.assign(d1, [id], tagIds, false)
      return { id, status: 'tagged', tagIds }
    } catch (error) {
      return { id, status: 'failed', reason: error instanceof AiError ? error.message : 'Tags could not be suggested for this picture.' }
    }
  }

  // Four at a time: quick enough for a batch, gentle on the provider's rate limit.
  const results: ItemResult[] = []
  for (let i = 0; i < ids.length; i += 4) results.push(...(await Promise.all(ids.slice(i, i + 4).map(tag))))
  return json({ ok: results.every((r) => r.status !== 'failed'), provider, results })
}
