import { deleteMediaKeys, putMediaObject, readMediaObject } from '@/localapi/storage'

import { contentHash } from './hash'
import * as store from './store'
import { versionKey, versionsToPrune } from './versions'

type Doc = { id: number; filename: string; mimeType: string | null; filesize?: number | null; width?: number | null; height?: number | null }

/**
 * Keeps the file as it is now as a numbered version, then trims to the newest `keep`. Never throws: a failure to keep a
 * version must not stop the replace that asked for it. Returns whether a version was kept.
 */
export async function snapshotCurrent(d1: store.D1, doc: Doc, keep: number, userId: number | null, note: string, nowIso: string): Promise<boolean> {
  if (keep <= 0) return false
  try {
    const current = await readMediaObject(doc.filename)
    if (!current) return false
    const key = versionKey(doc.id, nowIso, doc.filename)
    await putMediaObject(key, current.data, current.contentType)
    await store.addVersion(d1, {
      mediaId: doc.id, r2Key: key, filename: doc.filename, mimeType: doc.mimeType ?? current.contentType, filesize: doc.filesize ?? current.data.byteLength,
      width: doc.width ?? null, height: doc.height ?? null, contentHash: await contentHash(current.data), note, userId, createdAt: nowIso,
    })
    await store.logActivity(d1, doc.id, 'replace', note, userId, nowIso)
    const stale = versionsToPrune(await store.listVersions(d1, doc.id), keep)
    if (stale.length > 0) {
      await deleteMediaKeys(stale.map((v) => v.r2Key))
      for (const v of stale) await store.deleteVersionRow(d1, v.id)
    }
    return true
  } catch (error) {
    console.error('Keeping a version failed:', error)
    return false
  }
}
