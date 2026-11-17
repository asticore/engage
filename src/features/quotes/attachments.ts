import { cleanFileName, inspectUpload, UploadRefusal, type UploadPolicy } from '@/features/media/fileTypes'

/**
 * Files a customer attaches to a request (a drawing, a photo, a brief).
 *
 * The same rules as the Media library decide what is acceptable (extension on the Media settings allow-list, and the
 * file's own first bytes must match it). The files are private: they sit in the media bucket under `quote-uploads/<number>/`,
 * which the public media route refuses, and only the admin route /api/admin-quote-file serves them, as downloads. The
 * request number in the key is the link, so no column is needed; removing a request removes the prefix.
 */

export const QUOTE_UPLOAD_PREFIX = 'quote-uploads/'
export const MAX_QUOTE_FILES = 5

export type PendingQuoteFile = { name: string; type: string; size: number; data: Uint8Array }
export type CheckedQuoteFile = { name: string; type: string; data: Uint8Array }
export type QuoteFileInfo = { key: string; name: string; size: number }

const NUMBER = /^QR-[A-Z0-9]{1,12}$/

export const quoteFilePrefix = (number: string): string => `${QUOTE_UPLOAD_PREFIX}${number}/`

/** A key for one file: the request, a random token and the cleaned name. */
export function buildQuoteKey(number: string, name: string, random: () => string = () => crypto.randomUUID()): string {
  const { base, extension } = cleanFileName(name)
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80) || 'file'
  return `${quoteFilePrefix(number)}${random()}-${safe}.${extension || 'bin'}`
}

/** True for a key this module could have made for this request: the guard before serving or deleting a stored file. */
export const isQuoteKey = (number: string, key: string): boolean =>
  NUMBER.test(number) && key.startsWith(quoteFilePrefix(number)) && !key.includes('..') && !key.includes('\0') && key.length <= 300

/** Checks the files against the site policy. A message fit for the customer on the first problem, otherwise the files ready to store. */
export function checkQuoteFiles(files: PendingQuoteFile[], policy: UploadPolicy): { error: string } | { ok: CheckedQuoteFile[] } {
  if (files.length > MAX_QUOTE_FILES) return { error: `Please attach ${MAX_QUOTE_FILES} files or fewer.` }
  const ok: CheckedQuoteFile[] = []
  for (const file of files) {
    try {
      const inspected = inspectUpload({ name: file.name, mimetype: file.type, data: file.data }, policy)
      ok.push({ name: inspected.name, type: inspected.mimeType, data: inspected.data })
    } catch (error) {
      return { error: error instanceof UploadRefusal ? error.message : 'That file could not be read.' }
    }
  }
  return { ok }
}

type Bucket = {
  put: (key: string, data: Uint8Array, options: { httpMetadata: { contentType: string } }) => Promise<unknown>
  list: (options: { prefix: string; limit?: number }) => Promise<{ objects: { key: string; size: number }[] }>
  get: (key: string) => Promise<unknown>
  delete: (keys: string | string[]) => Promise<void>
}

export async function getQuoteBucket(): Promise<Bucket> {
  const { getUploadBucket } = await import('@/features/forms/upload')
  return (await getUploadBucket()) as never as Bucket
}

export async function storeQuoteFiles(bucket: Pick<Bucket, 'put'>, number: string, files: CheckedQuoteFile[]): Promise<void> {
  for (const file of files) await bucket.put(buildQuoteKey(number, file.name), file.data, { httpMetadata: { contentType: file.type } })
}

/** The files stored for a request. The shown name drops the random token. */
export async function listQuoteFiles(bucket: Pick<Bucket, 'list'>, number: string): Promise<QuoteFileInfo[]> {
  if (!NUMBER.test(number)) return []
  const listed = await bucket.list({ prefix: quoteFilePrefix(number), limit: 50 })
  return listed.objects.map((o) => ({ key: o.key, name: o.key.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, ''), size: o.size }))
}

export async function deleteQuoteFiles(bucket: Pick<Bucket, 'list' | 'delete'>, number: string): Promise<number> {
  const files = await listQuoteFiles(bucket, number)
  if (files.length > 0) await bucket.delete(files.map((f) => f.key))
  return files.length
}
