import { NextResponse } from 'next/server'

import { authorizeMedia } from '@/features/media/access'
import { ACCEPTED_TYPES, fileKindOf } from '@/features/media/fileTypes'
import { readLimitedForm } from '@/features/media/readBody'
import { readUploadPolicy, type MediaEngine } from '@/features/media/store'
import { checkUpload, recordUpload } from '@/features/dam/onUpload'
import { inheritedDefaults, withAltPrefix } from '@/features/media/folderRecords'
import { listRecords, userMayUse, type D1 as FolderD1 } from '@/features/media/folderRecordsStore'
import { quotaRefusal } from '@/features/dam/quotaGuard'
import { saveRights, type D1 as DamStoreD1 } from '@/features/dam/store'
import { getSettings as getDamSettings, type D1 as DamD1 } from '@/features/dam/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { ValidationError } from '@/localapi/operations'
import { getFeatureFlags } from '@/utilities/features'
import type { UploadFile } from '@/localapi/uploads'

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** A readable starting alt text from a picture's file name: `harbour_sunset-2.jpg` becomes `harbour sunset 2`. */
function altFromName(name: string): string {
  return name
    .replace(/\.[^.]*$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 125)
}

/**
 * GET /api/admin-media-upload
 *
 * What the browser needs to prepare an upload: the allowed extensions (for the
 * file picker's `accept` list) and the size limit (to refuse an oversized file
 * before sending it).
 */
export async function GET(): Promise<Response> {
  const auth = await authorizeMedia('create')
  if (!auth.context) return auth.response
  const policy = await readUploadPolicy(auth.context.engine as unknown as MediaEngine)
  const accept = ACCEPTED_TYPES.filter((type) => policy.allowedExtensions.includes(type.extension)).map((type) => `.${type.extension}`)
  return NextResponse.json({ accept, maxBytes: policy.maxBytes })
}

/**
 * POST /api/admin-media-upload   (multipart: file, alt?, caption?, folder?)
 *
 * Uploads ONE file to the library. The library page sends several files as
 * several requests so each gets its own progress and its own error. The file is
 * checked from its own bytes against the allow-list in Media settings (see
 * features/media/fileTypes.ts), then stored through the same engine call as the
 * regular upload form, so optimisation, folders and name collisions behave
 * identically.
 *
 * Alt text is required for pictures only: a picture sent without it gets one
 * drafted from its file name (flagged in the reply so the page can say so).
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeMedia('create')
  if (!auth.context) return auth.response
  const engine = auth.context.engine as unknown as MediaEngine
  const policy = await readUploadPolicy(engine)

  // Refuse an oversized body before it is read into memory (also when no Content-Length is sent).
  const read = await readLimitedForm(request, policy.maxBytes)
  if ('response' in read) return read.response
  const form = read.form
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 })
  if (file.size > policy.maxBytes) {
    return NextResponse.json({ error: `Files must be ${Math.round(policy.maxBytes / (1024 * 1024))} MB or smaller.` }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const upload: UploadFile = { data: bytes, mimetype: file.type || 'application/octet-stream', name: file.name || 'upload', size: bytes.length }

  const alt = text(form.get('alt'), 300)
  const folder = text(form.get('folder'), 200).replace(/^\/+|\/+$/g, '')
  const caption = text(form.get('caption'), 300)

  // Folder records: a folder limited to roles or companies refuses people outside them, and a folder's defaults apply to new files.
  let folderDefaults = { altPrefix: '', defaultLicence: '' }
  if (folder) {
    try {
      const fd1 = (await rawD1()) as never as FolderD1
      if (!(await userMayUse(fd1, auth.context.user, auth.context.isAdmin, folder))) {
        return NextResponse.json({ error: 'You do not have access to that folder.' }, { status: 403 })
      }
      folderDefaults = inheritedDefaults(await listRecords(fd1), folder)
    } catch (error) {
      console.error('Folder rules could not be read; the upload goes on:', error)
    }
  }

  // Asset manager: spot a file that is already in the library (same bytes), and keep its hash and camera data after storing.
  let dam: { d1: DamD1; hash: string; duplicateOf: number | null } | null = null
  try {
    if ((await getFeatureFlags()).dam) {
      const d1 = (await rawD1()) as never as DamD1
      const checked = await checkUpload(d1, bytes)
      if (checked.duplicateOf && form.get('allowDuplicate') !== '1' && (await getDamSettings(d1)).duplicateAction === 'block') {
        return NextResponse.json({ error: 'This exact file is already in the library.', duplicateOf: checked.duplicateOf }, { status: 409 })
      }
      const refusal = await quotaRefusal(d1, auth.context.user, auth.context.isAdmin, bytes.byteLength)
      if (refusal) return NextResponse.json({ error: refusal }, { status: 413 })
      dam = { d1, ...checked }
    }
  } catch (error) {
    console.error('Asset manager check failed; the upload goes on:', error)
  }

  try {
    // Pictures need alt text; give a draft when none was typed so a batch of pictures can go in at once.
    const looksLikePicture = fileKindOf(upload.mimetype) === 'image' || /\.(jpe?g|png|gif|webp|avif)$/i.test(upload.name)
    const altText = alt || (looksLikePicture ? withAltPrefix(folderDefaults.altPrefix, altFromName(upload.name)) : '')
    const doc = await engine.create({
      collection: 'media',
      data: { alt: altText, caption, folder, source: 'upload' },
      file: upload,
      overrideAccess: true,
    })
    const isPicture = typeof doc.mimeType === 'string' && doc.mimeType.startsWith('image/')
    if (dam) await recordUpload(dam.d1, Number(doc.id), bytes, upload.mimetype, dam.hash, caption, String(doc.alt ?? ''), Number((auth.context.user as { id?: unknown } | null)?.id) || null, new Date().toISOString())
    if (dam && folderDefaults.defaultLicence) {
      try {
        const nowIso = new Date().toISOString()
        const assets = await import('@/features/dam/store').then((m) => m.getAssets(dam.d1 as DamStoreD1, [Number(doc.id)]))
        const rights = assets.get(Number(doc.id))?.rights
        if (rights && !rights.licenceType) await saveRights(dam.d1 as DamStoreD1, Number(doc.id), { ...rights, licenceType: folderDefaults.defaultLicence }, nowIso)
      } catch (error) {
        console.error('Folder default licence not applied:', error)
      }
    }
    return NextResponse.json({
      ok: true,
      doc: {
        id: doc.id,
        filename: doc.filename,
        url: doc.url,
        alt: doc.alt,
        mimeType: doc.mimeType,
        filesize: doc.filesize,
        width: doc.width ?? null,
        height: doc.height ?? null,
      },
      altDrafted: isPicture && !alt,
      duplicateOf: dam?.duplicateOf ?? null,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      const message = error.errors[0]?.message ?? 'This file cannot be used.'
      // A type or content refusal is a 415; anything else the form got wrong is a 400.
      return NextResponse.json({ error: message }, { status: error.errors[0]?.path === 'file' ? (/MB or smaller/.test(message) ? 413 : 415) : 400 })
    }
    console.error('Media upload failed:', error)
    return NextResponse.json({ error: 'The file could not be saved. Try again shortly.' }, { status: 502 })
  }
}
