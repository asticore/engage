// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import type { CleanupDb } from '@/features/cleanup/db'
import { collectMediaFilenames, deleteFiles } from '@/features/cleanup/emptyFiles'

function makeDb(): { db: CleanupDb; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  const db: CleanupDb = {
    listTables: async () => (raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name),
    listIndexes: async () => [],
    countRows: async (t) => Number((raw.prepare(`SELECT COUNT(*) AS n FROM \`${t}\``).get() as { n: number }).n),
    run: async (sql) => raw.exec(sql),
    all: async <T,>(sql: string) => raw.prepare(sql).all() as T[],
  }
  return { db, raw }
}

describe('clearing media files with the rows', () => {
  it('collects the file and each generated size, ignoring blanks', async () => {
    const { db, raw } = makeDb()
    raw.exec("CREATE TABLE eg_media (id integer primary key, filename text, sizes_thumb_filename text, sizes_card_filename text, alt text)")
    raw.exec("INSERT INTO eg_media VALUES (1,'a.jpg','a-thumb.jpg',NULL,'x'),(2,'b.png','','b-card.png','y'),(3,NULL,NULL,NULL,'z')")
    expect((await collectMediaFilenames(db)).sort()).toEqual(['a-thumb.jpg', 'a.jpg', 'b-card.png', 'b.png'])
  })
  it('gives nothing when the media table is absent', async () => {
    expect(await collectMediaFilenames(makeDb().db)).toEqual([])
  })
  it('deletes in chunks of 1000 and counts a failed chunk', async () => {
    const calls: number[] = []
    const bucket = { delete: async (keys: string | string[]) => { const n = Array.isArray(keys) ? keys.length : 1; calls.push(n); if (calls.length === 2) throw new Error('boom') } }
    const keys = Array.from({ length: 2500 }, (_, i) => `f${i}.jpg`)
    expect(await deleteFiles(bucket, keys)).toEqual({ deleted: 1500, failed: 1000 })
    expect(calls).toEqual([1000, 1000, 500])
  })
})
