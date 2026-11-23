import { resolveD1Binding } from '@/cms/db/connect'

import type { Datasource, DatasourceItem } from './core'

/** Shared option lists, in a table created on first use (no migration). */

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
export type DsD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

let ensured: Promise<void> | null = null
export async function dsDb(): Promise<DsD1> {
  const d1 = (await resolveD1Binding()) as unknown as DsD1
  if (!ensured) {
    ensured = (async () => {
      await d1.prepare('CREATE TABLE IF NOT EXISTS eg_datasources (slug TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, items TEXT NOT NULL DEFAULT \'[]\', updated_at TEXT)').bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}

type Raw = { slug: string; label: string; items: string }
const toDs = (r: Raw): Datasource => {
  let items: DatasourceItem[] = []
  try {
    items = JSON.parse(r.items) as DatasourceItem[]
  } catch {
    items = []
  }
  return { slug: r.slug, label: r.label, items }
}

export async function listDatasources(db: DsD1): Promise<Datasource[]> {
  const r = await db.prepare('SELECT slug, label, items FROM eg_datasources ORDER BY label').bind().all<Raw>()
  return (r.results ?? []).map(toDs)
}

export async function saveDatasource(db: DsD1, ds: Datasource, at: string): Promise<void> {
  await db.prepare('INSERT INTO eg_datasources (slug, label, items, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(slug) DO UPDATE SET label = ?2, items = ?3, updated_at = ?4').bind(ds.slug, ds.label, JSON.stringify(ds.items), at).run()
}

export async function deleteDatasource(db: DsD1, slug: string): Promise<void> {
  await db.prepare('DELETE FROM eg_datasources WHERE slug = ?1').bind(slug).run()
}

/** slug -> items, for resolving fields. An error (table cannot be read) gives no lists, so forms keep their own options. */
export async function datasourceMap(): Promise<Record<string, DatasourceItem[]>> {
  try {
    const out: Record<string, DatasourceItem[]> = {}
    for (const d of await listDatasources(await dsDb())) out[d.slug] = d.items
    return out
  } catch {
    return {}
  }
}
