import { downloadForImport } from '@/features/dam/importUrl'
import { checkUpload, recordUpload } from '@/features/dam/onUpload'
import { quotaRefusal } from '@/features/dam/quotaGuard'
import * as damStore from '@/features/dam/store'
import { inheritedDefaults } from '@/features/media/folderRecords'
import { listRecords, type D1 as FolderD1 } from '@/features/media/folderRecordsStore'
import type { MediaEngine } from '@/features/media/store'
import type { UploadFile } from '@/localapi/uploads'

export type ImportContext = { engine: MediaEngine; user: unknown; isAdmin: boolean; userId: number | null; d1: damStore.D1; dam: boolean; maxBytes: number }
export type ImportResult =
  | { ok: true; doc: { id: unknown; filename: unknown; url: unknown; mimeType: unknown; filesize: unknown }; duplicateOf: number | null }
  | { ok: false; status: number; error: string; duplicateOf?: number }

/**
 * Downloads one address and stores it like an upload: quota, duplicate check, folder defaults, activity log.
 * Throws ImportError and ValidationError for the route to turn into a response.
 */
export async function saveImportedFile(ctx: ImportContext, url: URL, drive: boolean, folder: string, activityLabel: string): Promise<ImportResult> {
  const got = await downloadForImport(url, ctx.maxBytes, drive)
  const quota = await quotaRefusal(ctx.d1, ctx.user as never, ctx.isAdmin, got.data.byteLength)
  if (quota) return { ok: false, status: 413, error: quota }
  const checked = ctx.dam ? await checkUpload(ctx.d1, got.data) : { hash: '', duplicateOf: null }
  if (ctx.dam && checked.duplicateOf && (await damStore.getSettings(ctx.d1)).duplicateAction === 'block') {
    return { ok: false, status: 409, error: 'This exact file is already in the library.', duplicateOf: checked.duplicateOf }
  }
  const defaults = folder ? inheritedDefaults(await listRecords(ctx.d1 as never as FolderD1), folder) : { altPrefix: '', defaultLicence: '' }
  const file: UploadFile = { data: got.data, mimetype: got.mimeType, name: got.filename, size: got.data.byteLength }
  const alt = got.mimeType.startsWith('image/') ? `${defaults.altPrefix ? `${defaults.altPrefix} ` : ''}${got.filename.replace(/\.[^.]*$/, '').replace(/[_\-.]+/g, ' ').trim()}`.slice(0, 300) : ''
  const doc = await ctx.engine.create({ collection: 'media', data: { alt, folder, source: 'upload', sourceUrl: drive ? '' : url.href.slice(0, 2048) }, file, overrideAccess: true })
  if (ctx.dam) {
    const now = new Date().toISOString()
    await recordUpload(ctx.d1, Number(doc.id), got.data, got.mimeType, checked.hash, '', String(doc.alt ?? ''), ctx.userId, now)
    await damStore.logActivity(ctx.d1, Number(doc.id), 'import', activityLabel, ctx.userId, now)
    if (defaults.defaultLicence) {
      const rights = (await damStore.getAssets(ctx.d1, [Number(doc.id)])).get(Number(doc.id))?.rights
      if (rights && !rights.licenceType) await damStore.saveRights(ctx.d1, Number(doc.id), { ...rights, licenceType: defaults.defaultLicence }, now)
    }
  }
  return { ok: true, doc: { id: doc.id, filename: doc.filename, url: doc.url, mimeType: doc.mimeType, filesize: doc.filesize }, duplicateOf: checked.duplicateOf }
}
