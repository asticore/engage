import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { exifForStorage, exifSearchWords, parseExif } from '@/features/dam/exif'
import { buildSearchText, fieldsFor, parseMetaField, validateMetaValues } from '@/features/dam/metaFields'
import { canMoveStatus, checkRights, parseRights, STATUSES, type AssetStatus } from '@/features/dam/rights'
import * as store from '@/features/dam/store'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { loadMedia, parseIdList, readJsonBody, type MediaEngine } from '@/features/media/store'
import { readMediaObject } from '@/localapi/storage'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const auth = await authorizeMedia(write ? 'update' : 'read')
  if (!auth.context) return { response: auth.response }
  if (!(await getFeatureFlags()).dam) return { response: json({ error: 'Switch Asset manager on in Site Settings first.' }, 409) }
  return { context: auth.context }
}

const positive = (v: unknown): number | null => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null)
const caption = (media: Record<string, unknown>): string => (typeof media.caption === 'string' ? media.caption : '')
const alt = (media: Record<string, unknown>): string => (typeof media.alt === 'string' ? media.alt : '')

/**
 * GET: `?id=12` one file's details (rights, status check, metadata, camera data, collections, activity, the fields that
 * apply); no id returns the settings, collections, fields and the licences expiring soon or already expired.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await guard(request, false)
  if (denied.response) return denied.response
  const d1 = (await rawD1()) as never as store.D1
  const settings = await store.getSettings(d1)
  const url = new URL(request.url)
  const id = positive(url.searchParams.get('id'))
  const now = new Date()
  if (url.searchParams.get('unusable') === '1') {
    return json({ ids: await store.unusableIds(d1, now.toISOString().slice(0, 10), settings.requireApproval) })
  }
  if (id) {
    const engine = denied.context.engine as unknown as MediaEngine
    const media = await loadMedia(engine, id)
    if (!media) return json({ error: 'File not found.' }, 404)
    const asset = (await store.getAssets(d1, [id])).get(id) ?? store.defaultAsset(id)
    const fields = await store.listFields(d1)
    return json({
      asset,
      check: checkRights(asset.rights, now, { warnDays: settings.expiryWarnDays, requireApproval: settings.requireApproval }),
      fields: fieldsFor(fields, media.mimeType),
      collections: await store.collectionsForMedia(d1, id),
      allCollections: await store.listCollections(d1),
      activity: await store.listActivity(d1, id, 20),
      settings,
    })
  }
  const today = now.toISOString().slice(0, 10)
  const until = new Date(now.getTime() + settings.expiryWarnDays * 86_400_000).toISOString().slice(0, 10)
  return json({
    settings,
    collections: await store.listCollections(d1),
    fields: await store.listFields(d1),
    expiring: await store.expiringSoon(d1, today, until),
    expired: await store.expiredIds(d1, today),
  })
}

/** POST { action: saveRights | saveMeta | extract | setStatus | saveCollection | deleteCollection | assignCollection | saveField | deleteField | saveSettings, ... }. */
export async function POST(request: Request): Promise<Response> {
  const denied = await guard(request, true)
  if (denied.response) return denied.response
  const body = await readJsonBody(request)
  if (!body) return json({ error: 'Send the details.' }, 400)
  const context = denied.context
  const engine = context.engine as unknown as MediaEngine
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()
  const userId = positive((context.user as { id?: unknown } | null)?.id)
  const id = positive(body.id)
  const isAdmin = context.isAdmin === true
  switch (body.action) {
    case 'saveRights': {
      if (!id) return json({ error: 'Pick a file.' }, 400)
      const parsed = parseRights(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      const current = (await store.getAssets(d1, [id])).get(id) ?? store.defaultAsset(id)
      const move = canMoveStatus(current.rights.status, parsed.value.status, isAdmin)
      if (move.ok === false) return json({ error: move.error }, 403)
      await store.saveRights(d1, id, parsed.value, now)
      await store.logActivity(d1, id, 'rights', parsed.value.status === current.rights.status ? 'Rights changed' : `Status: ${parsed.value.status}`, userId, now)
      return json({ ok: true })
    }
    case 'saveMeta': {
      if (!id) return json({ error: 'Pick a file.' }, 400)
      const media = await loadMedia(engine, id)
      if (!media) return json({ error: 'File not found.' }, 404)
      const fields = await store.listFields(d1)
      const values = validateMetaValues(fields, media.mimeType, (body.values && typeof body.values === 'object' ? body.values : {}) as Record<string, unknown>)
      if (values.ok === false) return json({ error: values.error }, 400)
      const asset = (await store.getAssets(d1, [id])).get(id) ?? store.defaultAsset(id)
      await store.saveMeta(d1, id, values.value, buildSearchText(fields, values.value, [caption(media), alt(media), ...exifSearchWords(asset.exif as never)]), now)
      await store.logActivity(d1, id, 'metadata', '', userId, now)
      return json({ ok: true })
    }
    case 'extract': {
      const ids = parseIdList(body.ids)
      if (!ids) return json({ error: 'Choose files.' }, 400)
      const settings = await store.getSettings(d1)
      const fields = await store.listFields(d1)
      let read = 0
      let skipped = 0
      for (const mediaId of ids) {
        const media = await loadMedia(engine, mediaId)
        if (!media?.filename || !/jpe?g/i.test(media.mimeType ?? '')) {
          skipped++
          continue
        }
        const object = await readMediaObject(media.filename)
        if (!object) {
          skipped++
          continue
        }
        const exif = exifForStorage(parseExif(object.data), settings.stripGps)
        const asset = (await store.getAssets(d1, [mediaId])).get(mediaId) ?? store.defaultAsset(mediaId)
        await store.saveExif(d1, mediaId, exif, buildSearchText(fields, asset.meta, [caption(media), alt(media), ...exifSearchWords(exif)]), now)
        read++
      }
      return json({ ok: true, read, skipped })
    }
    case 'setStatus': {
      const ids = parseIdList(body.ids)
      const status = String(body.status) as AssetStatus
      if (!ids || !STATUSES.includes(status)) return json({ error: 'Choose files and a status.' }, 400)
      if (status === 'approved' && !isAdmin) return json({ error: 'Only an admin can approve files.' }, 403)
      await store.setStatus(d1, ids, status, now)
      for (const mediaId of ids) await store.logActivity(d1, mediaId, 'status', status, userId, now)
      return json({ ok: true })
    }
    case 'saveCollection': {
      const parsed = store.parseCollection(body, await store.listCollections(d1), id)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      return json({ ok: true, id: await store.saveCollection(d1, id, parsed.value, now) })
    }
    case 'deleteCollection':
      if (!id) return json({ error: 'Pick one.' }, 400)
      await store.deleteCollection(d1, id)
      return json({ ok: true })
    case 'assignCollection': {
      const ids = parseIdList(body.mediaIds)
      const collectionId = positive(body.collectionId)
      if (!ids || !collectionId) return json({ error: 'Choose files and a collection.' }, 400)
      if (!(await store.listCollections(d1)).some((c) => c.id === collectionId)) return json({ error: 'That collection no longer exists.' }, 400)
      await store.assignCollection(d1, collectionId, ids, body.remove === true)
      return json({ ok: true })
    }
    case 'saveField': {
      if (!isAdmin) return json({ error: 'Only an admin can change the metadata fields.' }, 403)
      const parsed = parseMetaField(body, await store.listFields(d1), id)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      return json({ ok: true, id: await store.saveField(d1, id, parsed.value, now) })
    }
    case 'deleteField':
      if (!isAdmin) return json({ error: 'Only an admin can change the metadata fields.' }, 403)
      if (!id) return json({ error: 'Pick one.' }, 400)
      await store.deleteField(d1, id)
      return json({ ok: true })
    case 'saveSettings': {
      if (!isAdmin) return json({ error: 'Only an admin can change the asset manager settings.' }, 403)
      const parsed = store.parseSettings(body)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      await store.saveSettings(d1, parsed.value)
      return json({ ok: true })
    }
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
}
