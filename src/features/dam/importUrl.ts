/**
 * Import a file into the library from an address or a Google Drive share link (Task 29g). Pure parts first, then the
 * download. Only https, never a private or local host, redirects followed by hand and every hop checked, size capped
 * while the bytes arrive. Drive import covers files shared as "anyone with the link"; it asks for no Google sign-in.
 */
import { isPrivateHostname } from '@/features/media/stock'

export class ImportError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const DRIVE_ID = /^[\w-]{10,}$/

/** Turns a Drive share link into its direct download address; other addresses are returned checked. */
export function parseImportAddress(value: string): { url: URL; drive: boolean } {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new ImportError('That address is not valid.', 400)
  }
  assertSafe(url)
  const host = url.hostname.toLowerCase()
  if (host === 'docs.google.com') throw new ImportError('Google Docs, Sheets and Slides cannot be imported as files. Download them from Drive as PDF or Office files first.', 400)
  if (host === 'drive.google.com') {
    const match = /\/file\/d\/([^/]+)/.exec(url.pathname)
    const id = match?.[1] ?? url.searchParams.get('id') ?? ''
    if (!DRIVE_ID.test(id)) throw new ImportError('Use a Drive link to one file ("Share" then "Anyone with the link").', 400)
    return { url: new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`), drive: true }
  }
  return { url, drive: false }
}

/** Throws unless the address is https, has no credentials, uses the default port and is not a local host. */
export function assertSafe(url: URL): void {
  if (url.protocol !== 'https:') throw new ImportError('Only https addresses can be imported.', 400)
  if (url.username || url.password) throw new ImportError('That address is not allowed.', 400)
  if (url.port && url.port !== '443') throw new ImportError('That address is not allowed.', 400)
  if (isPrivateHostname(url.hostname)) throw new ImportError('That address is not allowed.', 400)
}

/** A safe file name from a Content-Disposition header or the address path. */
export function importFileName(disposition: string | null, url: URL, mimeType: string): string {
  const fromHeader = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition ?? '')?.[1]
  let name = fromHeader ? decodeURIComponentSafe(fromHeader) : decodeURIComponentSafe(url.pathname.split('/').filter(Boolean).pop() ?? '')
  name = name.replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(0, 100).trim()
  if (!name || name === 'uc') name = 'imported'
  if (!/\.[A-Za-z0-9]{2,5}$/.test(name)) {
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf', 'image/svg+xml': 'svg', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4' } as Record<string, string>)[mimeType]
    if (ext) name = `${name}.${ext}`
  }
  return name
}
const decodeURIComponentSafe = (v: string): string => {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])

export async function downloadForImport(start: URL, maxBytes: number, drive: boolean, fetchImpl: typeof fetch = fetch): Promise<{ data: Uint8Array; mimeType: string; filename: string }> {
  let url = start
  let response: Response | null = null
  for (let hop = 0; hop < 4; hop += 1) {
    try {
      response = await fetchImpl(url.href, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'EngageImport/1.0' } })
    } catch {
      throw new ImportError('The file could not be downloaded. Try again shortly.', 502)
    }
    if (!REDIRECTS.has(response.status)) break
    const location = response.headers.get('location')
    if (!location) throw new ImportError('The file could not be downloaded.', 502)
    url = new URL(location, url)
    assertSafe(url)
    response = null
  }
  if (!response) throw new ImportError('The address redirected too many times.', 502)
  if (!response.ok) throw new ImportError(`The file could not be downloaded (${response.status}).`, 502)
  const mimeType = (response.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim().toLowerCase()
  if (mimeType === 'text/html') {
    throw new ImportError(drive ? 'Drive did not give the file. Check it is shared as "Anyone with the link" and is not a very large file.' : 'That address is a web page, not a file.', 415)
  }
  if (Number(response.headers.get('content-length') ?? '0') > maxBytes) throw new ImportError('That file is larger than the upload limit.', 413)
  if (!response.body) throw new ImportError('The file was empty.', 400)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new ImportError('That file is larger than the upload limit.', 413)
    }
    chunks.push(value)
  }
  const data = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    data.set(c, at)
    at += c.byteLength
  }
  return { data, mimeType, filename: importFileName(response.headers.get('content-disposition'), url, mimeType) }
}
