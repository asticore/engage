import { descendantIds, parseFilesCsv, parseTagsCsv, type Tag, type TagInput } from './logic'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = (d1: D1, sql: string, ...args: unknown[]) => d1.prepare(sql).bind(...args).run()
const chunks = <T,>(list: T[], n: number): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

export async function listTags(d1: D1): Promise<Tag[]> {
  return (await all(d1, 'SELECT id, name, parent_id, color FROM eg_media_tags ORDER BY name')).map((r) => ({ id: Number(r.id), name: String(r.name), parentId: r.parent_id === null ? null : Number(r.parent_id), color: String(r.color ?? '#888888') }))
}
export async function listLinks(d1: D1): Promise<Array<{ mediaId: number; tagId: number }>> {
  return (await all(d1, 'SELECT media_id, tag_id FROM eg_media_tag_links')).map((r) => ({ mediaId: Number(r.media_id), tagId: Number(r.tag_id) }))
}
export async function saveTag(d1: D1, id: number | null, v: TagInput, nowIso: string): Promise<number> {
  if (id) {
    await run(d1, 'UPDATE eg_media_tags SET name=?1, parent_id=?2, color=?3, updated_at=?4 WHERE id=?5', v.name, v.parentId, v.color, nowIso, id)
    return id
  }
  const res = await run(d1, 'INSERT INTO eg_media_tags (name, parent_id, color, updated_at, created_at) VALUES (?1,?2,?3,?4,?4)', v.name, v.parentId, v.color, nowIso)
  return Number(res.meta?.last_row_id ?? 0)
}
/** Deleting a tag moves its children up a level and drops its links. Files are untouched. */
export async function deleteTag(d1: D1, id: number): Promise<void> {
  const tag = (await listTags(d1)).find((t) => t.id === id)
  if (!tag) return
  await run(d1, 'UPDATE eg_media_tags SET parent_id = ?1 WHERE parent_id = ?2', tag.parentId, id)
  await run(d1, 'DELETE FROM eg_media_tag_links WHERE tag_id = ?1', id)
  await run(d1, 'DELETE FROM eg_media_tags WHERE id = ?1', id)
}
export async function assign(d1: D1, mediaIds: number[], tagIds: number[], remove: boolean): Promise<void> {
  for (const m of mediaIds) {
    for (const t of tagIds) {
      if (remove) await run(d1, 'DELETE FROM eg_media_tag_links WHERE media_id = ?1 AND tag_id = ?2', m, t)
      else await run(d1, 'INSERT OR IGNORE INTO eg_media_tag_links (media_id, tag_id) VALUES (?1, ?2)', m, t)
    }
  }
}
/** Media ids carrying a tag or any of its sub-tags. */
export async function mediaIdsForTag(d1: D1, tagId: number): Promise<number[]> {
  const ids = descendantIds(await listTags(d1), tagId)
  const out = new Set<number>()
  for (const part of chunks(ids, 50)) {
    for (const r of await all(d1, `SELECT DISTINCT media_id FROM eg_media_tag_links WHERE tag_id IN (${part.map((_, i) => `?${i + 1}`).join(',')})`, ...part)) out.add(Number(r.media_id))
  }
  return [...out]
}
/** Tags per file for a page of files. */
export async function tagsForMedia(d1: D1, mediaIds: number[]): Promise<Record<number, number[]>> {
  const out: Record<number, number[]> = {}
  for (const part of chunks(mediaIds, 50)) {
    for (const r of await all(d1, `SELECT media_id, tag_id FROM eg_media_tag_links WHERE media_id IN (${part.map((_, i) => `?${i + 1}`).join(',')})`, ...part)) (out[Number(r.media_id)] ??= []).push(Number(r.tag_id))
  }
  return out
}
export async function taggedFiles(d1: D1): Promise<Array<{ filename: string; tagIds: number[] }>> {
  const rows = await all(d1, 'SELECT m.filename AS filename, l.tag_id AS tag_id FROM eg_media_tag_links l JOIN eg_media m ON m.id = l.media_id ORDER BY m.filename')
  const map = new Map<string, number[]>()
  for (const r of rows) (map.get(String(r.filename)) ?? map.set(String(r.filename), []).get(String(r.filename))!).push(Number(r.tag_id))
  return [...map].map(([filename, tagIds]) => ({ filename, tagIds }))
}

/** Creates the tags in a tags CSV (existing ones kept, colour set only on new ones). Returns how many were new. */
export async function importTags(d1: D1, text: string, nowIso: string): Promise<number> {
  let created = 0
  const tags = await listTags(d1)
  for (const row of parseTagsCsv(text)) {
    let parentId: number | null = null
    for (let i = 0; i < row.path.length; i++) {
      const name = row.path[i]
      const found = tags.find((t) => t.parentId === parentId && t.name.toLowerCase() === name.toLowerCase())
      if (found) { parentId = found.id; continue }
      const color = i === row.path.length - 1 ? row.color : '#888888'
      const id = await saveTag(d1, null, { name, parentId, color }, nowIso)
      tags.push({ id, name, parentId, color })
      created++
      parentId = id
    }
  }
  return created
}
/** Applies a files CSV: creates missing tags, links tags to files found by filename. */
export async function importFiles(d1: D1, text: string, nowIso: string): Promise<{ linked: number; missing: number }> {
  const rows = parseFilesCsv(text)
  const tags = await listTags(d1)
  let linked = 0
  let missing = 0
  for (const row of rows) {
    // Two files can share a filename (the export lists them once with both files' tags), so every match gets the tags.
    const files = await all(d1, 'SELECT id FROM eg_media WHERE filename = ?1', row.filename)
    if (files.length === 0) { missing++; continue }
    for (const path of row.paths) {
      let parentId: number | null = null
      for (const name of path) {
        let found = tags.find((t) => t.parentId === parentId && t.name.toLowerCase() === name.toLowerCase())
        if (!found) {
          const id = await saveTag(d1, null, { name, parentId, color: '#888888' }, nowIso)
          found = { id, name, parentId, color: '#888888' }
          tags.push(found)
        }
        parentId = found.id
      }
      if (parentId !== null) { await assign(d1, files.map((f) => Number(f.id)), [parentId], false); linked++ }
    }
  }
  return { linked, missing }
}
