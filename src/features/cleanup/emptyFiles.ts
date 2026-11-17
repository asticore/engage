import type { CleanupDb } from './db'

/** The slice of an R2 bucket used here, so a test can fake it. */
export type FileBucket = { delete: (keys: string | string[]) => Promise<void> }

/** Section keys whose uploaded files live in the site's R2 bucket and can be cleared with the rows. Backups go to the destination chosen on the Backups screen, not this bucket. */
export const FILE_SECTIONS = ['media'] as const

/** Every file name the media table points at (the file itself and each generated size), read before the rows are deleted. */
export async function collectMediaFilenames(db: CleanupDb): Promise<string[]> {
  const tables = await db.listTables()
  if (!tables.includes('eg_media')) return []
  const columns = (await db.all<{ name: string }>('PRAGMA table_info(`eg_media`)')).map((c) => c.name).filter((name) => name === 'filename' || /^sizes_.+_filename$/.test(name))
  const names = new Set<string>()
  for (const column of columns) {
    const rows = await db.all<Record<string, unknown>>(`SELECT \`${column}\` AS f FROM \`eg_media\` WHERE \`${column}\` IS NOT NULL AND \`${column}\` <> ''`)
    for (const row of rows) if (typeof row.f === 'string' && row.f && !row.f.includes('/..') && !row.f.startsWith('..')) names.add(row.f)
  }
  return [...names]
}

/** Deletes the named objects from the bucket, 1000 at a time (the R2 limit). Returns how many names were sent; a failed chunk is counted in `failed`. */
export async function deleteFiles(bucket: FileBucket, keys: string[]): Promise<{ deleted: number; failed: number }> {
  let deleted = 0
  let failed = 0
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000)
    try {
      await bucket.delete(chunk)
      deleted += chunk.length
    } catch {
      failed += chunk.length
    }
  }
  return { deleted, failed }
}
