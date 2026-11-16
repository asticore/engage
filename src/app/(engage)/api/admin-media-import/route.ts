import { NextResponse } from 'next/server'

import { downloadForImport, ImportError, parseImportAddress } from '@/features/dam/importUrl'
import { checkUpload, recordUpload } from '@/features/dam/onUpload'
import { quotaRefusal } from '@/features/dam/quotaGuard'
import * as damStore from '@/features/dam/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { inheritedDefaults } from '@/features/media/folderRecords'
import { listRecords, userMayUse, type D1 as FolderD1 } from '@/features/media/folderRecordsStore'
import { sanitizeFolder } from '@/features/media/folders'
import { readJsonBody, readUploadPolicy, type MediaEngine } from '@/features/media/store'
import { ValidationError } from '@/localapi/operations'
import type { UploadFile } from '@/localapi/uploads'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin-media-import  { url, folder? }
 * Downloads one file from an https address or a Google Drive share link ("anyone with the link") and stores it like an
 * upload: type and size checks, folder rules and defaults, quotas, duplicate check, activity log.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
  const auth = await authorizeMedia('create')
  if (!auth.context) return auth.response
  const body = await readJsonBody(request)
  if (!body || typeof body.url !== 'string') return NextResponse.json({ error: 'Send the address to import.' }, { status: 400 })
  const folder = sanitizeFolder(body.folder) ?? ''
  const engine = auth.context.engine as unknown as MediaEngine
  const userId = Number((auth.context.user as { id?: unknown } | null)?.id) || null
  try {
    const policy = await readUploadPolicy(engine)
    const { url, drive } = parseImportAddress(body.url)
    const d1 = (await rawD1()) as never as damStore.D1
    if (folder && !(await userMayUse(d1 as never as FolderD1, auth.context.user, auth.context.isAdmin, folder))) return NextResponse.json({ error: 'You do not have access to that folder.' }, { status: 403 })
    const got = await downloadForImport(url, policy.maxBytes, drive)
    const quota = await quotaRefusal(d1, auth.context.user, auth.context.isAdmin, got.data.byteLength)
    if (quota) return NextResponse.json({ error: quota }, { status: 413 })
    const dam = (await getFeatureFlags()).dam
    const checked = dam ? await checkUpload(d1, got.data) : { hash: '', duplicateOf: null }
    if (dam && checked.duplicateOf && (await damStore.getSettings(d1)).duplicateAction === 'block') {
      return NextResponse.json({ error: 'This exact file is already in the library.', duplicateOf: checked.duplicateOf }, { status: 409 })
    }
    const defaults = folder ? inheritedDefaults(await listRecords(d1 as never as FolderD1), folder) : { altPrefix: '', defaultLicence: '' }
    const file: UploadFile = { data: got.data, mimetype: got.mimeType, name: got.filename, size: got.data.byteLength }
    const alt = got.mimeType.startsWith('image/') ? `${defaults.altPrefix ? `${defaults.altPrefix} ` : ''}${got.filename.replace(/\.[^.]*$/, '').replace(/[_\-.]+/g, ' ').trim()}`.slice(0, 300) : ''
    const doc = await engine.create({ collection: 'media', data: { alt, folder, source: 'upload', sourceUrl: drive ? '' : url.href.slice(0, 2048) }, file, overrideAccess: true })
    if (dam) {
      const now = new Date().toISOString()
      await recordUpload(d1, Number(doc.id), got.data, got.mimeType, checked.hash, '', String(doc.alt ?? ''), userId, now)
      await damStore.logActivity(d1, Number(doc.id), 'import', drive ? 'Google Drive link' : url.hostname, userId, now)
      if (defaults.defaultLicence) {
        const rights = (await damStore.getAssets(d1, [Number(doc.id)])).get(Number(doc.id))?.rights
        if (rights && !rights.licenceType) await damStore.saveRights(d1, Number(doc.id), { ...rights, licenceType: defaults.defaultLicence }, now)
      }
    }
    return NextResponse.json({ ok: true, doc: { id: doc.id, filename: doc.filename, url: doc.url, mimeType: doc.mimeType, filesize: doc.filesize }, duplicateOf: checked.duplicateOf })
  } catch (error) {
    if (error instanceof ImportError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.errors[0]?.message ?? 'This file cannot be used.' }, { status: /MB or smaller/.test(error.errors[0]?.message ?? '') ? 413 : 415 })
    console.error('Import failed:', error)
    return NextResponse.json({ error: 'The file could not be saved. Try again shortly.' }, { status: 502 })
  }
}
