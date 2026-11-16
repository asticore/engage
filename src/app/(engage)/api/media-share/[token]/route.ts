import { rawD1 } from '@/features/ecommerce/server/db'
import { checkRights } from '@/features/dam/rights'
import { hashToken, isToken, SHARE_MESSAGES, shareState } from '@/features/dam/share'
import * as store from '@/features/dam/store'
import { buildZip } from '@/features/dam/zip'
import { verifyPassword } from '@/features/visibility/password'
import { applySafeServingHeaders, readMediaObject } from '@/localapi/storage'

export const dynamic = 'force-dynamic'

const MAX_ZIP_FILES = 100
const MAX_ZIP_BYTES = 100 * 1024 * 1024

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const SAFE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

function page(status: number, title: string, body: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px;max-width:720px;margin-inline:auto;color:#1a1a1a;background:#fff}@media(prefers-color-scheme:dark){body{background:#151515;color:#eee}a{color:#8ab4ff}}ul{list-style:none;padding:0}li{padding:8px 0;border-bottom:1px solid #8884}input,button{font:inherit;padding:8px 12px}button{cursor:pointer}img{max-width:120px;max-height:80px;vertical-align:middle;margin-right:8px}.muted{color:#777;font-size:14px}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`
  return new Response(html, { status, headers: { ...SAFE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'" } })
}

const passwordForm = (error: string): string =>
  `${error ? `<p role="alert">${esc(error)}</p>` : ''}<form method="post"><label>Password <input type="password" name="password" required autocomplete="off"></label> <button type="submit">Open</button></form>`

type Resolved = { files: store.MediaRow[]; usable: Set<number> }

async function resolveFiles(d1: store.D1, kind: 'file' | 'collection', targetId: number): Promise<Resolved> {
  const settings = await store.getSettings(d1)
  const now = new Date()
  let ids: number[]
  if (kind === 'file') ids = [targetId]
  else {
    const collection = (await store.listCollections(d1)).find((c) => c.id === targetId)
    if (!collection) ids = []
    else if (collection.smart) ids = await store.smartCollectionIds(d1, targetId, { todayIso: now.toISOString().slice(0, 10), warnUntilIso: now.toISOString().slice(0, 10) })
    else ids = await store.mediaIdsInCollection(d1, targetId)
  }
  const files = await store.mediaRows(d1, ids.slice(0, 500))
  const assets = await store.getAssets(d1, files.map((f) => f.id))
  const usable = new Set<number>()
  for (const f of files) {
    const rights = (assets.get(f.id) ?? store.defaultAsset(f.id)).rights
    if (checkRights(rights, now, { warnDays: settings.expiryWarnDays, requireApproval: settings.requireApproval }).usable) usable.add(f.id)
  }
  return { files, usable }
}

async function download(d1: store.D1, shareId: number, file: store.MediaRow): Promise<Response> {
  if (!(await store.takeDownload(d1, shareId))) return page(410, 'Link used up', `<p>${SHARE_MESSAGES.used_up}</p>`)
  await store.logActivity(d1, file.id, 'download', 'Share link', null, new Date().toISOString()).catch((): void => undefined)
  const object = await readMediaObject(file.filename)
  if (!object) return page(404, 'File not found', '<p>This file is no longer available.</p>')
  const headers = new Headers({ ...SAFE_HEADERS, 'Content-Type': file.mimeType || object.contentType })
  applySafeServingHeaders(headers, file.filename)
  const safe = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  headers.set('Content-Disposition', `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
  headers.set('Content-Length', String(object.data.byteLength))
  return new Response(object.data as unknown as BodyInit, { headers })
}

async function downloadZip(d1: store.D1, shareId: number, files: store.MediaRow[]): Promise<Response> {
  if (files.length === 0) return page(404, 'Nothing to download', '<p>There are no files to download.</p>')
  if (files.length > MAX_ZIP_FILES || files.reduce((n, f) => n + f.filesize, 0) > MAX_ZIP_BYTES) return page(413, 'Too big for one download', `<p>A zip holds up to ${MAX_ZIP_FILES} files and 100 MB. Download the files one at a time.</p>`)
  if (!(await store.takeDownload(d1, shareId))) return page(410, 'Link used up', `<p>${SHARE_MESSAGES.used_up}</p>`)
  const entries: Array<{ name: string; data: Uint8Array }> = []
  for (const f of files) {
    await store.logActivity(d1, f.id, 'download', 'Share link zip', null, new Date().toISOString()).catch((): void => undefined)
    const object = await readMediaObject(f.filename)
    if (object) entries.push({ name: f.filename, data: object.data })
  }
  const zip = buildZip(entries, new Date())
  return new Response(zip as unknown as BodyInit, { headers: { ...SAFE_HEADERS, 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="files.zip"', 'Content-Length': String(zip.byteLength) } })
}

function listing(files: store.MediaRow[], password: string): Response {
  const hidden = password ? `<input type="hidden" name="password" value="${esc(password)}">` : ''
  const method = password ? 'post' : 'get'
  const rows = files
    .map((f) => {
      const preview = !password && f.mimeType.startsWith('image/') ? `<img src="?file=${f.id}&inline=1" alt="${esc(f.alt)}">` : ''
      return `<li>${preview}<form method="${method}" style="display:inline"><input type="hidden" name="file" value="${f.id}">${hidden}<button type="submit">${esc(f.filename)}</button> <span class="muted">${Math.max(1, Math.round(f.filesize / 1024))} KB</span></form></li>`
    })
    .join('')
  const zip = files.length > 1 ? `<form method="${method}"><input type="hidden" name="zip" value="1">${hidden}<button type="submit">Download all as a zip</button></form>` : ''
  return page(200, files.length === 1 ? 'Shared file' : 'Shared files', `${files.length === 0 ? '<p>Nothing to show.</p>' : `<ul>${rows}</ul>${zip}`}`)
}

async function handle(request: Request, params: Promise<{ token: string }>, form: URLSearchParams | null): Promise<Response> {
  const { token } = await params
  if (!isToken(token)) return page(404, 'Link not found', '<p>This link is not valid.</p>')
  const d1 = (await rawD1()) as never as store.D1
  const share = await store.getShareByHash(d1, await hashToken(token)).catch((): null => null)
  if (!share) return page(404, 'Link not found', '<p>This link is not valid.</p>')
  const state = shareState(share, new Date())
  if (state !== 'ok') return page(410, 'Link unavailable', `<p>${SHARE_MESSAGES[state]}</p>`)

  const url = new URL(request.url)
  const field = (name: string): string => form?.get(name) ?? url.searchParams.get(name) ?? ''
  let password = ''
  if (share.passwordHash) {
    password = form?.get('password') ?? ''
    if (!password) return page(401, 'Password needed', passwordForm(''))
    if (!(await verifyPassword(password, share.passwordHash))) return page(401, 'Password needed', passwordForm('That password is not right.'))
  }
  const { files, usable } = await resolveFiles(d1, share.kind, share.targetId)
  const open = files.filter((f) => usable.has(f.id))
  if (open.length === 0) return page(404, 'Nothing to show', '<p>The shared files cannot be used right now.</p>')

  const fileId = Number(field('file'))
  if (fileId) {
    const file = open.find((f) => f.id === fileId)
    if (!file) return page(404, 'File not found', '<p>That file is not part of this link.</p>')
    // A picture preview in the listing is not a download and is not counted (only for links without a password).
    if (!password && field('inline') === '1' && file.mimeType.startsWith('image/')) {
      const object = await readMediaObject(file.filename)
      if (!object) return page(404, 'File not found', '<p>This file is no longer available.</p>')
      const headers = new Headers({ ...SAFE_HEADERS, 'Content-Type': file.mimeType })
      applySafeServingHeaders(headers, file.filename)
      return new Response(object.data as unknown as BodyInit, { headers })
    }
    return download(d1, share.id, file)
  }
  if (field('zip') === '1') return downloadZip(d1, share.id, open)
  return listing(open, password)
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  return handle(request, params, null)
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const text = await request.text()
  if (text.length > 4096) return page(413, 'Too much data', '<p>That request is too big.</p>')
  return handle(request, params, new URLSearchParams(text))
}
