import { exifForStorage, exifSearchWords, parseExif } from './exif'
import { contentHash } from './hash'
import { buildSearchText } from './metaFields'
import * as store from './store'

/** Looks for a file already in the library with identical bytes. */
export async function findDuplicate(d1: store.D1, hash: string): Promise<number | null> {
  if (!hash) return null
  const row = (await d1.prepare('SELECT media_id FROM eg_media_assets WHERE content_hash = ?1 LIMIT 1').bind(hash).all<{ media_id: number }>()).results[0]
  return row ? Number(row.media_id) : null
}

export type UploadCheck = { hash: string; duplicateOf: number | null }

/** Hashes the bytes about to be stored and finds a duplicate. Never throws: a failure means no duplicate is reported. */
export async function checkUpload(d1: store.D1, bytes: Uint8Array): Promise<UploadCheck> {
  try {
    const hash = await contentHash(bytes)
    return { hash, duplicateOf: await findDuplicate(d1, hash) }
  } catch {
    return { hash: '', duplicateOf: null }
  }
}

/** After a file is stored: keep its hash, read camera data from a JPEG and make it searchable. Never throws. */
export async function recordUpload(d1: store.D1, mediaId: number, bytes: Uint8Array, mimeType: string, hash: string, caption: string, alt: string, userId: number | null, nowIso: string): Promise<void> {
  try {
    const settings = await store.getSettings(d1)
    await d1.prepare('INSERT OR IGNORE INTO eg_media_assets (media_id, created_at, updated_at) VALUES (?1, ?2, ?2)').bind(mediaId, nowIso).run()
    await d1.prepare('UPDATE eg_media_assets SET content_hash=?1, updated_at=?2 WHERE media_id=?3').bind(hash, nowIso, mediaId).run()
    let words: string[] = []
    if (settings.autoExtract && /jpe?g/i.test(mimeType)) {
      const exif = exifForStorage(parseExif(bytes), settings.stripGps)
      words = exifSearchWords(exif)
      if (Object.keys(exif).length > 0) await store.saveExif(d1, mediaId, exif, buildSearchText([], {}, [caption, alt, ...words]), nowIso)
    }
    if (settings.requireApproval) await store.setStatus(d1, [mediaId], 'in_review', nowIso)
    await store.logActivity(d1, mediaId, 'upload', '', userId, nowIso)
  } catch (error) {
    console.error('Recording asset details failed:', error)
  }
}
