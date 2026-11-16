import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { analyseFile, searchTextFor } from '@/features/dam/onUpload'
import { docPart, fieldsFor, parseMetaField, validateMetaValues } from '@/features/dam/metaFields'
import { canMoveStatus, checkRights, parseRights, STATUSES, type AssetStatus } from '@/features/dam/rights'
import * as store from '@/features/dam/store'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { loadMedia, parseIdList, readJsonBody, type MediaEngine } from '@/features/media/store'
import { applySafeServingHeaders, readMediaObject, putMediaObject } from '@/localapi/storage'
import { filtersFromParams, parseFilters, type SearchContext } from '@/features/dam/search'
import { pathOf } from '@/features/mediaTags/logic'
import * as tagStore from '@/features/mediaTags/store'
import { forgetPrivateCache } from '@/features/dam/access'
import { hashToken, newToken, parseShareInput } from '@/features/dam/share'
import { buildZip } from '@/features/dam/zip'
import { sanitizeFolder } from '@/features/media/folders'
import { hashPassword } from '@/features/visibility/password'
import { parseRendition } from '@/features/dam/renditions'
import { replaceEverywhere } from '@/features/dam/replaceEverywhere'
import { snapshotCurrent } from '@/features/dam/versionsIo'
import { ALLOW_USED_DELETE } from '@/features/dam/safeDelete'
import { mediaUpdater } from '@/features/media/store'
import { clearUsageCache } from '@/features/media/usage'
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

/** Dates and tag ids the search builder needs, resolved once per request. */
async function searchContext(d1: store.D1, now: Date, warnDays: number, tagId: number): Promise<SearchContext> {
  const ctx: SearchContext = { todayIso: now.toISOString().slice(0, 10), warnUntilIso: new Date(now.getTime() + warnDays * 86_400_000).toISOString().slice(0, 10) }
  if (tagId && (await getFeatureFlags()).mediatags) ctx.tagIds = await store.tagWithChildren(d1, tagId)
  return ctx
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
  const sharesFor = url.searchParams.get('shares')
  if ((sharesFor === 'file' || sharesFor === 'collection') && id) return json({ shares: await store.listShares(d1, sharesFor, id) })
  const zipIds = url.searchParams.get('zipIds')
  if (zipIds) {
    const ids = parseIdList(zipIds.split(',').map((v) => Number(v)))
    if (!ids) return json({ error: 'Choose up to 100 files.' }, 400)
    const rows = await store.mediaRows(d1, ids)
    if (rows.reduce((n, r) => n + r.filesize, 0) > 100 * 1024 * 1024) return json({ error: 'A zip holds up to 100 MB. Choose fewer files.' }, 413)
    const entries: Array<{ name: string; data: Uint8Array }> = []
    for (const row of rows) {
      const object = await readMediaObject(row.filename)
      if (object) entries.push({ name: row.filename, data: object.data })
    }
    if (entries.length === 0) return json({ error: 'None of those files could be read.' }, 404)
    const zip = buildZip(entries, now)
    for (const row of rows) await store.logActivity(d1, row.id, 'download', 'Zip', Number((denied.context.user as { id?: unknown } | null)?.id) || null, now.toISOString())
    return new Response(zip as unknown as BodyInit, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="media.zip"', 'Cache-Control': 'private, no-store', 'Content-Length': String(zip.byteLength) } })
  }
  if (url.searchParams.get('searchMeta') === '1') {
    const tags = (await getFeatureFlags()).mediatags ? await tagStore.listTags(d1 as never) : []
    return json({
      saved: await store.listSavedSearches(d1),
      fields: (await store.listFields(d1)).filter((f) => f.searchable).map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options })),
      collections: (await store.listCollections(d1)).filter((c) => !c.smart).map((c) => ({ id: c.id, name: c.name })),
      tags: tags.map((t) => ({ id: t.id, label: pathOf(tags, t.id) })),
    })
  }
  if (url.searchParams.get('search') === '1') {
    const filters = filtersFromParams(url.searchParams)
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize')) || 48))
    return json(await store.runSearch(d1, filters, await searchContext(d1, now, settings.expiryWarnDays, filters.tagId), page, pageSize))
  }
  // A kept version's bytes, for the compare view. Served with the same safe headers as public files.
  const versionFile = positive(url.searchParams.get('versionFile'))
  if (id && versionFile) {
    const version = await store.getVersion(d1, id, versionFile)
    const stored = version ? await readMediaObject(version.r2Key) : null
    if (!version || !stored) return json({ error: 'That version is not available.' }, 404)
    const headers = new Headers({ 'Content-Type': version.mimeType || stored.contentType, 'Cache-Control': 'private, no-store' })
    applySafeServingHeaders(headers, version.filename)
    return new Response(stored.data as unknown as BodyInit, { headers })
  }
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
      versions: await store.listVersions(d1, id),
      renditions: await store.listRenditions(d1),
      mimeType: media.mimeType ?? '',
      mediaUrl: typeof media.url === 'string' ? media.url : null,
      settings,
    })
  }
  const today = now.toISOString().slice(0, 10)
  const until = new Date(now.getTime() + settings.expiryWarnDays * 86_400_000).toISOString().slice(0, 10)
  return json({
    settings,
    collections: await store.listCollections(d1),
    folderRules: await store.listFolderRules(d1),
    fields: await store.listFields(d1),
    expiring: await store.expiringSoon(d1, today, until),
    expired: await store.expiredIds(d1, today),
    renditions: await store.listRenditions(d1),
    totals: await store.storageTotals(d1),
    quotaUsage: await store.quotaUsages(d1, settings.quotas),
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
      await store.saveMeta(d1, id, values.value, searchTextFor(fields, values.value, caption(media), alt(media), asset.exif as never, docPart(asset.searchText)), now)
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
        if (!media?.filename) {
          skipped++
          continue
        }
        const object = await readMediaObject(media.filename)
        if (!object) {
          skipped++
          continue
        }
        const { exif, text } = await analyseFile(object.data, media.mimeType ?? '', settings)
        if (Object.keys(exif).length === 0 && !text) {
          skipped++
          continue
        }
        const asset = (await store.getAssets(d1, [mediaId])).get(mediaId) ?? store.defaultAsset(mediaId)
        await store.saveExif(d1, mediaId, Object.keys(exif).length > 0 ? exif : (asset.exif as never), searchTextFor(fields, asset.meta, caption(media), alt(media), Object.keys(exif).length > 0 ? exif : (asset.exif as never), text || docPart(asset.searchText)), now)
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
      const target = (await store.listCollections(d1)).find((c) => c.id === collectionId)
      if (!target) return json({ error: 'That collection no longer exists.' }, 400)
      if (target.smart) return json({ error: 'A smart collection fills itself from its search. Change the search instead.' }, 400)
      await store.assignCollection(d1, collectionId, ids, body.remove === true)
      return json({ ok: true })
    }
    case 'saveSearch':
    case 'saveSmartCollection': {
      const name = store.parseSearchName(body.name)
      if (name.ok === false) return json({ error: name.error }, 400)
      const filters = parseFilters((body.filters && typeof body.filters === 'object' ? body.filters : {}) as Record<string, unknown>)
      if (body.action === 'saveSearch') return json({ ok: true, id: await store.saveSearch(d1, name.value, filters, userId, now) })
      if ((await store.listCollections(d1)).some((c) => c.name.toLowerCase() === name.value.toLowerCase())) return json({ error: 'There is already a collection with that name.' }, 400)
      return json({ ok: true, id: await store.saveSmartCollection(d1, name.value, filters, now) })
    }
    case 'deleteSearch':
      if (!id) return json({ error: 'Pick one.' }, 400)
      await store.deleteSearch(d1, id)
      return json({ ok: true })
    case 'setVisibility': {
      const ids = parseIdList(body.ids)
      const visibility = body.visibility === 'private' ? 'private' : body.visibility === 'public' ? 'public' : null
      if (!ids || !visibility) return json({ error: 'Choose files and public or private.' }, 400)
      await store.setVisibility(d1, ids, visibility, now)
      forgetPrivateCache()
      for (const mediaId of ids) await store.logActivity(d1, mediaId, 'visibility', visibility, userId, now)
      return json({ ok: true })
    }
    case 'saveFolderRule': {
      if (!isAdmin) return json({ error: 'Only an admin can make a folder private.' }, 403)
      const path = sanitizeFolder(body.path)
      const visibility = body.visibility === 'private' || body.visibility === 'public' || body.visibility === 'inherit' ? body.visibility : null
      if (!path || !visibility) return json({ error: 'Type a folder path like products/summer and choose private, public or the parent folder\'s setting.' }, 400)
      await store.saveFolderRule(d1, path, visibility, now)
      forgetPrivateCache()
      return json({ ok: true })
    }
    case 'createShare': {
      const parsed = parseShareInput(body, new Date())
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      const v = parsed.value
      if (v.kind === 'file' ? !(await loadMedia(engine, v.targetId)) : !(await store.listCollections(d1)).some((c) => c.id === v.targetId)) return json({ error: 'That is no longer there.' }, 404)
      const token = newToken()
      await store.createShare(d1, { tokenHash: await hashToken(token), kind: v.kind, targetId: v.targetId, expiresAt: v.expiresAt, passwordHash: v.password ? await hashPassword(v.password) : '', maxDownloads: v.maxDownloads, userId }, now)
      if (v.kind === 'file') await store.logActivity(d1, v.targetId, 'share', `Link until ${v.expiresAt?.slice(0, 10)}`, userId, now)
      return json({ ok: true, url: `${new URL(request.url).origin}/api/media-share/${token}`, expiresAt: v.expiresAt })
    }
    case 'revokeShare':
      if (!id) return json({ error: 'Pick one.' }, 400)
      await store.revokeShare(d1, id)
      return json({ ok: true })
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
    case 'restoreVersion': {
      const versionId = positive(body.versionId)
      if (!id || !versionId) return json({ error: 'Pick a version.' }, 400)
      const media = await loadMedia(engine, id)
      const version = await store.getVersion(d1, id, versionId)
      if (!media?.filename || !version) return json({ error: 'That version no longer exists.' }, 404)
      const stored = await readMediaObject(version.r2Key)
      if (!stored) return json({ error: 'The stored copy of that version is missing.' }, 410)
      // The file as it is now becomes a version first, so a restore can be undone.
      const settings = await store.getSettings(d1)
      await snapshotCurrent(d1, { id, filename: media.filename, mimeType: media.mimeType, filesize: media.filesize, width: media.width, height: media.height }, Math.max(settings.keepVersions, 1), userId, 'Before restore', now)
      const update = mediaUpdater(engine)
      const previous = { mimeType: media.mimeType, filesize: media.filesize, width: media.width, height: media.height }
      await update(id, { mimeType: version.mimeType, filesize: version.filesize, width: version.width, height: version.height })
      try {
        await putMediaObject(media.filename, stored.data, version.mimeType || stored.contentType)
      } catch (error) {
        await update(id, previous).catch((): void => undefined)
        console.error('Restoring a version failed:', error)
        return json({ error: 'The version could not be restored. The file is unchanged.' }, 502)
      }
      await store.logActivity(d1, id, 'restore', `Version from ${version.createdAt.slice(0, 16).replace('T', ' ')}`, userId, now)
      return json({ ok: true })
    }
    case 'deleteVersion': {
      const versionId = positive(body.versionId)
      if (!id || !versionId) return json({ error: 'Pick a version.' }, 400)
      const version = await store.getVersion(d1, id, versionId)
      if (!version) return json({ error: 'That version no longer exists.' }, 404)
      const { deleteMediaKeys } = await import('@/localapi/storage')
      await deleteMediaKeys([version.r2Key])
      await store.deleteVersionRow(d1, versionId)
      return json({ ok: true })
    }
    case 'replaceEverywhere': {
      const withId = positive(body.withId)
      if (!id || !withId || id === withId) return json({ error: 'Choose a different file to use instead.' }, 400)
      if (!(await loadMedia(engine, withId))) return json({ error: 'The replacement file was not found.' }, 404)
      const result = await replaceEverywhere(engine as never, id, withId)
      await store.logActivity(d1, id, 'replace-everywhere', `Now uses file #${withId} in ${result.changed} place${result.changed === 1 ? '' : 's'}`, userId, now)
      return json({ ok: true, ...result })
    }
    case 'deleteMedia': {
      if (!id) return json({ error: 'Pick a file.' }, 400)
      if (!context.can('media', 'delete') && !isAdmin) return json({ error: 'You cannot delete files.' }, 403)
      try {
        await (engine as unknown as { delete: (args: Record<string, unknown>) => Promise<unknown> }).delete({
          collection: 'media', id, overrideAccess: true,
          req: { context: { [ALLOW_USED_DELETE]: body.force === true } },
        })
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'The file could not be deleted.' }, 400)
      }
      clearUsageCache()
      return json({ ok: true })
    }
    case 'saveRendition': {
      if (!isAdmin) return json({ error: 'Only an admin can change rendition presets.' }, 403)
      const id = positive(body.id)
      const parsed = parseRendition(body, await store.listRenditions(d1), id)
      if (parsed.ok === false) return json({ error: parsed.error }, 400)
      return json({ ok: true, id: await store.saveRendition(d1, id, parsed.value, now) })
    }
    case 'deleteRendition': {
      if (!isAdmin) return json({ error: 'Only an admin can change rendition presets.' }, 403)
      const id = positive(body.id)
      if (!id) return json({ error: 'Choose a preset.' }, 400)
      await store.deleteRendition(d1, id)
      return json({ ok: true })
    }
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
