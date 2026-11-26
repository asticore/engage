import { resolveD1Binding } from '@/cms/db/connect'

import type { ReleaseCollection, ReleaseItem, ReleaseStatus } from './core'

/** Releases and their items, in tables created on first use (no migration). */

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
export type RelD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

let ensured: Promise<void> | null = null
export async function relDb(): Promise<RelD1> {
  const d1 = (await resolveD1Binding()) as unknown as RelD1
  if (!ensured) {
    ensured = (async () => {
      await d1.prepare("CREATE TABLE IF NOT EXISTS eg_releases (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name TEXT NOT NULL, publish_at TEXT, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, done_at TEXT, note TEXT)").bind().run()
      await d1.prepare('CREATE TABLE IF NOT EXISTS eg_release_items (release_id INTEGER NOT NULL, collection TEXT NOT NULL, doc_id INTEGER NOT NULL, before TEXT, PRIMARY KEY (release_id, collection, doc_id))').bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}

export type Release = { id: number; name: string; publishAt: string | null; status: ReleaseStatus; createdAt: string; doneAt: string | null; note: string | null; items: ReleaseItem[] }
type RawRel = { id: number; name: string; publish_at: string | null; status: ReleaseStatus; created_at: string; done_at: string | null; note: string | null }
type RawItem = { release_id: number; collection: ReleaseCollection; doc_id: number; before: 'draft' | 'published' | null }

export async function listReleases(db: RelD1): Promise<Release[]> {
  const rels = (await db.prepare('SELECT id, name, publish_at, status, created_at, done_at, note FROM eg_releases ORDER BY id DESC LIMIT 100').bind().all<RawRel>()).results ?? []
  const items = (await db.prepare('SELECT release_id, collection, doc_id, before FROM eg_release_items').bind().all<RawItem>()).results ?? []
  return rels.map((r) => ({
    id: r.id, name: r.name, publishAt: r.publish_at, status: r.status, createdAt: r.created_at, doneAt: r.done_at, note: r.note,
    items: items.filter((i) => i.release_id === r.id).map((i) => ({ collection: i.collection, docId: i.doc_id, before: i.before })),
  }))
}

export async function createRelease(db: RelD1, name: string, publishAt: string | null, at: string): Promise<void> {
  await db.prepare('INSERT INTO eg_releases (name, publish_at, status, created_at) VALUES (?1, ?2, \'open\', ?3)').bind(name, publishAt, at).run()
}
export async function updateRelease(db: RelD1, id: number, name: string, publishAt: string | null): Promise<void> {
  await db.prepare("UPDATE eg_releases SET name = ?2, publish_at = ?3 WHERE id = ?1 AND status = 'open'").bind(id, name, publishAt).run()
}
export async function setStatus(db: RelD1, id: number, status: ReleaseStatus, at: string, note: string | null): Promise<void> {
  await db.prepare('UPDATE eg_releases SET status = ?2, done_at = ?3, note = ?4 WHERE id = ?1').bind(id, status, at, note).run()
}
export async function deleteRelease(db: RelD1, id: number): Promise<void> {
  await db.prepare('DELETE FROM eg_release_items WHERE release_id = ?1').bind(id).run()
  await db.prepare('DELETE FROM eg_releases WHERE id = ?1').bind(id).run()
}
export async function addItem(db: RelD1, id: number, collection: string, docId: number): Promise<void> {
  await db.prepare("INSERT OR IGNORE INTO eg_release_items (release_id, collection, doc_id, before) SELECT ?1, ?2, ?3, NULL WHERE EXISTS (SELECT 1 FROM eg_releases WHERE id = ?1 AND status = 'open')").bind(id, collection, docId).run()
}
export async function removeItem(db: RelD1, id: number, collection: string, docId: number): Promise<void> {
  await db.prepare('DELETE FROM eg_release_items WHERE release_id = ?1 AND collection = ?2 AND doc_id = ?3').bind(id, collection, docId).run()
}
export async function recordBefore(db: RelD1, id: number, collection: string, docId: number, before: 'draft' | 'published'): Promise<void> {
  await db.prepare('UPDATE eg_release_items SET before = ?4 WHERE release_id = ?1 AND collection = ?2 AND doc_id = ?3').bind(id, collection, docId, before).run()
}
