// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import type { CleanupDb } from '@/features/cleanup/db'
import { emptyPhraseFor, exportFeatureData, runEmptyFeature } from '@/features/cleanup/emptyData'
import { DEFAULT_FLAGS, FEATURES } from '@/features/registry'

/** An in memory SQLite database dressed as the cleanup tool's database. */
function makeDb(): { db: CleanupDb; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:')
  const db: CleanupDb = {
    listTables: async () => (raw.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[]).map((r) => r.name),
    listIndexes: async () => [],
    countRows: async (t) => Number((raw.prepare(`SELECT COUNT(*) AS n FROM \`${t}\``).get() as { n: number }).n),
    run: async (sql) => raw.exec(sql),
    all: async <T,>(sql: string) => raw.prepare(sql).all() as T[],
  }
  return { db, raw }
}

const events = FEATURES.find((f) => f.key === 'events')!

describe('empty a section\'s data', () => {
  const setup = () => {
    const { db, raw } = makeDb()
    raw.exec('CREATE TABLE eg_events (id integer primary key, title text); CREATE TABLE eg_event_rsvps (id integer primary key, event integer); CREATE TABLE eg_pages (id integer primary key, title text); CREATE TABLE eg_orders (id integer primary key);')
    raw.exec("INSERT INTO eg_events VALUES (1,'a'),(2,'b'); INSERT INTO eg_event_rsvps VALUES (1,1),(2,1),(3,2); INSERT INTO eg_pages VALUES (1,'home'); INSERT INTO eg_orders VALUES (1);")
    return { db, raw }
  }

  it('plans first and changes nothing', async () => {
    const { db, raw } = setup()
    const plan = await runEmptyFeature(db, DEFAULT_FLAGS, { feature: 'events' })
    expect(plan).toMatchObject({ ok: true, dryRun: true })
    expect(plan.tables.map((t) => t.table).sort()).toEqual(['eg_event_rsvps', 'eg_events'])
    expect(plan.tables.find((t) => t.table === 'eg_events')!.rows).toBe(2)
    expect((raw.prepare('SELECT COUNT(*) AS n FROM eg_events').get() as { n: number }).n).toBe(2)
  })
  it('needs the typed phrase, then deletes rows but keeps the tables, core data and payment records', async () => {
    const { db, raw } = setup()
    const refused = await runEmptyFeature(db, { ...DEFAULT_FLAGS, events: true }, { feature: 'events', execute: true, confirm: 'nope' })
    expect(refused.refusals[0]).toMatch(/Type "empty events"/)
    expect((raw.prepare('SELECT COUNT(*) AS n FROM eg_events').get() as { n: number }).n).toBe(2)
    const done = await runEmptyFeature(db, { ...DEFAULT_FLAGS, events: true }, { feature: 'events', execute: true, confirm: emptyPhraseFor('events') })
    expect(done.ok).toBe(true)
    expect(done.emptied.sort()).toEqual(['eg_event_rsvps', 'eg_events'])
    expect((raw.prepare('SELECT COUNT(*) AS n FROM eg_events').get() as { n: number }).n).toBe(0)
    expect((raw.prepare('SELECT COUNT(*) AS n FROM eg_pages').get() as { n: number }).n).toBe(1)
    expect((raw.prepare('SELECT COUNT(*) AS n FROM eg_orders').get() as { n: number }).n).toBe(1)
    expect(await db.listTables()).toContain('eg_events')
  })
  it('never empties payment records, even for the shop (ecommerce) section', async () => {
    const { db, raw } = setup()
    const plan = await runEmptyFeature(db, DEFAULT_FLAGS, { feature: 'ecommerce' })
    expect(plan.tables.map((t) => t.table)).not.toContain('eg_orders')
    expect(plan.withheld.some((w) => w.table === 'eg_orders' && /Payment/.test(w.reason))).toBe(true)
    expect((raw.prepare('SELECT COUNT(*) AS n FROM eg_orders').get() as { n: number }).n).toBe(1)
  })
  it('refuses an unknown section', async () => {
    const { db } = setup()
    expect((await runEmptyFeature(db, DEFAULT_FLAGS, { feature: 'nope; DROP TABLE x', execute: true, confirm: 'x' })).refusals).toHaveLength(1)
  })
  it('offers a download of the rows first', async () => {
    const { db } = setup()
    const out = await exportFeatureData(db, DEFAULT_FLAGS, events.key)
    expect(out.ok).toBe(true)
    const parsed = JSON.parse(out.json) as { data: Record<string, unknown[]> }
    expect(parsed.data.eg_event_rsvps).toHaveLength(3)
    expect(parsed.data.eg_events).toHaveLength(2)
  })
  it('restarts the numbering only when asked', async () => {
    // plain sqlite: a table with AUTOINCREMENT keeps its counter unless reset
    const { db, raw } = makeDb()
    raw.exec('CREATE TABLE eg_events (id integer primary key autoincrement, title text)')
    raw.exec("INSERT INTO eg_events (title) VALUES ('a'),('b')")
    await runEmptyFeature(db, { ...DEFAULT_FLAGS, events: true }, { feature: 'events', execute: true, confirm: emptyPhraseFor(events.key) })
    raw.exec("INSERT INTO eg_events (title) VALUES ('c')")
    expect((raw.prepare('SELECT id FROM eg_events').get() as { id: number }).id).toBe(3)
    raw.exec('DELETE FROM eg_events')
    await runEmptyFeature(db, { ...DEFAULT_FLAGS, events: true }, { feature: 'events', execute: true, confirm: emptyPhraseFor(events.key), resetCounters: true })
    raw.exec("INSERT INTO eg_events (title) VALUES ('d')")
    expect((raw.prepare('SELECT id FROM eg_events').get() as { id: number }).id).toBe(1)
  })
  it('pages a large export in parts of 5000 rows', async () => {
    const { db, raw } = makeDb()
    raw.exec('CREATE TABLE eg_events (id integer primary key, title text)')
    raw.exec('WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 5200) INSERT INTO eg_events SELECT i, \'t\' FROM n')
    const first = await exportFeatureData(db, DEFAULT_FLAGS, events.key)
    expect(first.pages).toBe(2)
    expect(first.tables[0]).toMatchObject({ rows: 5000, truncated: true })
    const second = await exportFeatureData(db, DEFAULT_FLAGS, events.key, 1)
    expect(second.tables[0]).toMatchObject({ rows: 200, truncated: false })
    expect((JSON.parse(second.json) as { data: { eg_events: { id: number }[] } }).data.eg_events[0].id).toBe(5001)
  })
})
