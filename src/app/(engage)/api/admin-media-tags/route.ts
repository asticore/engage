import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { exportFilesCsv, exportTagsCsv, parseTag, buildTagTree } from '@/features/mediaTags/logic'
import * as store from '@/features/mediaTags/store'
import { parseIdList, readJsonBody } from '@/features/media/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const MAX_CSV = 1_000_000

async function guard(request: Request, write: boolean): Promise<Response | null> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
  }
  const auth = await authorizeMedia(write ? 'update' : 'read')
  if (!auth.context) return auth.response
  if (!(await getFeatureFlags()).mediatags) return json({ error: 'Switch Media tags on in Site Settings first.' }, 409)
  return null
}

/** GET: the tag tree. `?export=tags` or `?export=files` downloads a CSV. */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(request, false)
  if (denied) return denied
  const d1 = (await rawD1()) as never as store.D1
  const tags = await store.listTags(d1)
  const mediaId = Number(new URL(request.url).searchParams.get('media'))
  if (Number.isInteger(mediaId) && mediaId > 0) return json({ tags, selected: (await store.tagsForMedia(d1, [mediaId]))[mediaId] ?? [] })
  const kind = new URL(request.url).searchParams.get('export')
  if (kind === 'tags' || kind === 'files') {
    const csv = kind === 'tags' ? exportTagsCsv(tags) : exportFilesCsv(tags, await store.taggedFiles(d1))
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="media-${kind}.csv"`, 'Cache-Control': 'no-store' } })
  }
  return json({ tags, tree: buildTagTree(tags, await store.listLinks(d1)) })
}

/** POST { action: saveTag | deleteTag | assign | importTags | importFiles, ... }. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request, true)
  if (denied) return denied
  const body = await readJsonBody(request)
  if (!body) return json({ error: 'Send the details.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()
  const id = Number(body.id)
  const hasId = Number.isInteger(id) && id > 0
  switch (body.action) {
    case 'saveTag': {
      const parsed = parseTag(body, await store.listTags(d1), hasId ? id : null)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      return json({ ok: true, id: await store.saveTag(d1, hasId ? id : null, parsed.value, now) })
    }
    case 'deleteTag':
      if (!hasId) return json({ error: 'Pick one.' }, 400)
      await store.deleteTag(d1, id)
      return json({ ok: true })
    case 'assign': {
      const mediaIds = parseIdList(body.mediaIds)
      const tagIds = parseIdList(body.tagIds, 20)
      if (!mediaIds || !tagIds) return json({ error: 'Choose files and tags.' }, 400)
      const known = new Set((await store.listTags(d1)).map((t) => t.id))
      if (tagIds.some((t) => !known.has(t))) return json({ error: 'One of those tags no longer exists.' }, 400)
      await store.assign(d1, mediaIds, tagIds, body.remove === true)
      return json({ ok: true })
    }
    case 'importTags':
    case 'importFiles': {
      const csv = typeof body.csv === 'string' ? body.csv : ''
      if (!csv.trim() || csv.length > MAX_CSV) return json({ error: 'Paste the CSV text (up to 1 MB).' }, 400)
      if (body.action === 'importTags') return json({ ok: true, created: await store.importTags(d1, csv, now) })
      return json({ ok: true, ...(await store.importFiles(d1, csv, now)) })
    }
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
}
