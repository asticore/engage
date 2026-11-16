import { exifForStorage, exifSearchWords, parseExif } from './exif'
import { contentHash } from './hash'
import { buildSearchText, joinSearchText, type MetaField } from './metaFields'
import * as store from './store'
import { extractText } from './textExtract'

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

/**
 * Reads what can be read from a file's bytes: camera data from a JPEG and the words inside a PDF or Word document. GPS is
 * dropped unless the site keeps it. Never throws.
 */
export async function analyseFile(bytes: Uint8Array, mimeType: string, settings: store.Settings): Promise<{ exif: ReturnType<typeof parseExif>; text: string }> {
  try {
    const exif = /jpe?g/i.test(mimeType) ? exifForStorage(parseExif(bytes), settings.stripGps) : {}
    const text = await extractText(bytes, mimeType)
    return { exif, text }
  } catch {
    return { exif: {}, text: '' }
  }
}

/** The text stored for search, from every source the file has. */
export function searchTextFor(fields: MetaField[], meta: Record<string, string>, caption: string, alt: string, exif: ReturnType<typeof parseExif>, docText: string): string {
  return joinSearchText(buildSearchText(fields, meta, [caption, alt, ...exifSearchWords(exif)]), docText)
}

/** After a file is stored: keep its hash, read camera data and document text and make it searchable. Never throws. */
export async function recordUpload(d1: store.D1, mediaId: number, bytes: Uint8Array, mimeType: string, hash: string, caption: string, alt: string, userId: number | null, nowIso: string): Promise<void> {
  try {
    const settings = await store.getSettings(d1)
    await d1.prepare('INSERT OR IGNORE INTO eg_media_assets (media_id, created_at, updated_at) VALUES (?1, ?2, ?2)').bind(mediaId, nowIso).run()
    await d1.prepare('UPDATE eg_media_assets SET content_hash=?1, updated_at=?2 WHERE media_id=?3').bind(hash, nowIso, mediaId).run()
    const { exif, text } = settings.autoExtract ? await analyseFile(bytes, mimeType, settings) : { exif: {}, text: '' }
    if (Object.keys(exif).length > 0) await store.saveExif(d1, mediaId, exif, '', nowIso)
    await store.setSearchText(d1, mediaId, searchTextFor([], {}, caption, alt, exif, text), nowIso)
    if (settings.requireApproval) await store.setStatus(d1, [mediaId], 'in_review', nowIso)
    await store.logActivity(d1, mediaId, 'upload', '', userId, nowIso)
  } catch (error) {
    console.error('Recording asset details failed:', error)
  }
}
