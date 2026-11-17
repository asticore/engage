import type { Engine } from '@/engine'
import { deleteMediaKeys, getMediaBucket, putMediaObject, readMediaObject } from '@/localapi/storage'

import { COPY_KEY_PREFIX, MAX_COPIED_PICTURES, MAX_PICTURE_BYTES, copyKey, picturesAddedAfterCopy } from './core'

export type PictureStats = { copied: number; skipped: number }
export type PictureRestoreStats = { restored: number; removed: number; failed: number }

type MediaDoc = { id: number; filename?: unknown; mimeType?: unknown }

async function listMedia(engine: Engine): Promise<MediaDoc[]> {
  const found = await engine.find({ collection: 'media', limit: 1000, depth: 0, overrideAccess: true } as never)
  return ((found.docs ?? []) as MediaDoc[]).filter((d) => typeof d.filename === 'string' && d.filename !== '')
}

/** Copies each picture file next to the live ones (key `demo-copy/<file name>`) so a reset can bring it back. Big files and files past the cap are skipped. */
export async function copyPictures(engine: Engine): Promise<PictureStats> {
  await dropCopies()
  const stats: PictureStats = { copied: 0, skipped: 0 }
  for (const doc of await listMedia(engine)) {
    const name = String(doc.filename)
    if (stats.copied >= MAX_COPIED_PICTURES) {
      stats.skipped += 1
      continue
    }
    try {
      const object = await readMediaObject(name)
      if (!object || object.data.byteLength > MAX_PICTURE_BYTES) {
        stats.skipped += 1
        continue
      }
      await putMediaObject(copyKey(name), object.data, object.contentType)
      stats.copied += 1
    } catch {
      stats.skipped += 1
    }
  }
  return stats
}

/**
 * Before the import: puts back pictures whose file or record was lost after the copy, and deletes pictures uploaded
 * after it. `saved` is the picture list of the saved copy (file names).
 */
export async function restorePictures(engine: Engine, saved: { filename?: unknown; alt?: unknown }[]): Promise<PictureRestoreStats> {
  const stats: PictureRestoreStats = { restored: 0, removed: 0, failed: 0 }
  const names = saved.map((m) => (typeof m.filename === 'string' ? m.filename : '')).filter(Boolean)
  const live = await listMedia(engine)
  const liveNames = new Set(live.map((d) => String(d.filename)))

  for (const item of saved) {
    const name = typeof item.filename === 'string' ? item.filename : ''
    if (!name) continue
    try {
      const copy = await readMediaObject(copyKey(name))
      if (!copy) continue // no copy of the file was kept (too big or uploaded before this feature): nothing to restore from
      if (!liveNames.has(name)) {
        await engine.create({ collection: 'media', overrideAccess: true, data: { alt: typeof item.alt === 'string' ? item.alt : '' }, file: { data: copy.data, mimetype: copy.contentType, name, size: copy.data.byteLength } } as never)
        stats.restored += 1
      } else if (!(await readMediaObject(name))) {
        await putMediaObject(name, copy.data, copy.contentType)
        stats.restored += 1
      }
    } catch {
      stats.failed += 1
    }
  }

  for (const doc of picturesAddedAfterCopy(live, new Set(names))) {
    try {
      await engine.delete({ collection: 'media', id: doc.id, overrideAccess: true } as never)
      stats.removed += 1
    } catch {
      stats.failed += 1
    }
  }
  return stats
}

/** Removes every kept copy (a new saved copy replaces the old set). */
export async function dropCopies(): Promise<void> {
  const bucket = await getMediaBucket()
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: COPY_KEY_PREFIX, cursor, limit: 500 })
    await deleteMediaKeys(page.objects.map((o) => o.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}
