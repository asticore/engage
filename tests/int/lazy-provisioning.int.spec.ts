// @vitest-environment node
// Lazy sections: a fresh install keeps the tables of sections that are off out of the
// database, switching a section on creates them, an install that predates this keeps all of
// them, and the Unused tables guards hold.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { cleanupDbFromD1 } from '@/features/cleanup/db'
import { dropUnusedTable, exportUnusedTable, listUnusedTables, refusalFor } from '@/features/cleanup/unusedTables'
import { DEFAULT_FLAGS, type FeatureFlags } from '@/features/registry'
import { matchingSubmissions } from '@/features/privacy/data'
import { recentBackupRuns } from '@/features/cron/history'
import { consoleLogger } from '@/localapi/logger'
import { isFeatureDeferred, provisionFeature } from '@/migrations/provisioning'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'
import { readFeatureTableStates } from '@/migrations/schema/featureTablesState'

import { provisionAllFeatures } from '../helpers/provisionAll'

const created: { collection: string; data: Record<string, unknown> }[] = []
let d1: D1Database

vi.mock('@/cms/db/connect', () => ({ resolveD1Binding: async () => d1 }))
vi.mock('@/lib/engine', () => ({
  getEngine: async () => ({
    logger: { warn: (): void => undefined, info: (): void => undefined, error: (): void => undefined },
    find: async (): Promise<{ totalDocs: number; docs: unknown[] }> => ({ totalDocs: 0, docs: [] }),
    create: async (args: { collection: string; data: Record<string, unknown> }) => {
      created.push(args)
      return {}
    },
  }),
}))

const names = async (): Promise<string[]> => {
  const rows = await d1.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all()
  return (rows.results as { name: string }[]).map((row) => row.name)
}

describe('lazy sections', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let lazyFirst: string[]
  let lazySecond: string[]

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    d1 = proxy.env.D1
    const outcome = await runInternalMigrate(d1, consoleLogger, { baseline: false })
    expect(outcome.errorCount).toBe(0)
    lazyFirst = await names()
    expect((await runInternalMigrate(d1, consoleLogger, { baseline: false })).errorCount).toBe(0)
    lazySecond = await names()
  }, 400_000)

  afterAll(async () => {
    await proxy?.dispose()
  })

  it('a fresh install has core tables and no tables for sections that are off', () => {
    for (const table of ['eg_users', 'eg_pages', 'eg_media', 'eg_site_settings', 'eg_navigation', 'eg_tracking_events', 'eg_feature_tables']) expect(lazyFirst, table).toContain(table)
    for (const table of ['eg_products', 'eg_orders', 'eg_events', 'eg_posts', 'eg_forms', 'eg_backups', 'eg_redirects', 'eg_courses', 'eg_translations', 'eg_ad_units']) expect(lazyFirst, table).not.toContain(table)
    // No stray copies under the names the foundation migrations used before the eg_ rename.
    for (const table of ['products', 'events', 'posts', 'forms']) expect(lazyFirst, table).not.toContain(table)
  })

  it('a second run changes nothing', () => {
    expect(lazySecond).toEqual(lazyFirst)
  })

  it('records every section that owns tables as deferred, except those on by default', async () => {
    const states = await readFeatureTableStates(d1)
    expect(states.ecommerce).toBe('deferred')
    expect(states.events).toBe('deferred')
    expect(states.tracking).toBe('provisioned')
  })

  it('code that reads a missing section table gets nothing, not an error', async () => {
    expect(await matchingSubmissions(d1 as never, 'someone@example.com')).toEqual([])
    expect(await recentBackupRuns(d1)).toEqual([])
  })

  it('switching a section on creates its tables, once, and leaves the others out', async () => {
    const started = Date.now()
    const result = await provisionFeature(d1, consoleLogger, 'events')
    expect(result).toMatchObject({ ok: true, alreadyProvisioned: false })
    expect(Date.now() - started).toBeLessThan(60_000)
    const now = await names()
    for (const table of ['eg_events', 'eg_event_rsvps', '_eg_events_v']) expect(now, table).toContain(table)
    expect(now).not.toContain('events')
    expect(now).not.toContain('eg_products')
    expect(await isFeatureDeferred(d1, 'events')).toBe(false)
    expect(await provisionFeature(d1, consoleLogger, 'events')).toMatchObject({ ok: true, alreadyProvisioned: true })
    // The event columns the later migrations added are there too.
    const columns = ((await d1.prepare('PRAGMA table_info(`eg_events`)').all()).results as { name: string }[]).map((row) => row.name)
    expect(columns).toEqual(expect.arrayContaining(['slug', 'start_date', 'seo_focus_keyphrase']))
  }, 120_000)

  it('the Settings hook provisions a section that is switched on and adds its starter templates', async () => {
    const { provisionFeaturesBeforeChange } = await import('@/features/provisionOnEnable')
    expect(await isFeatureDeferred(d1, 'faq')).toBe(true)
    await provisionFeaturesBeforeChange({ data: { features: { faq: true, events: true, ecommerce: false } } })
    expect(await isFeatureDeferred(d1, 'faq')).toBe(false)
    expect(await isFeatureDeferred(d1, 'ecommerce')).toBe(true)
    expect(await names()).toContain('eg_faqs')
    expect(created.map((entry) => entry.data.name)).toContain('FAQ page')
  }, 120_000)

  describe('Unused tables', () => {
    const flagsOff: FeatureFlags = { ...DEFAULT_FLAGS }

    it('lists tables of sections that are off, with rows and size, and never core or sections that are on', async () => {
      const db = cleanupDbFromD1(d1 as never)
      const report = await listUnusedTables(db, flagsOff)
      const listed = report.tables.map((entry) => entry.table)
      expect(listed).toContain('eg_events')
      expect(listed).not.toContain('eg_pages')
      expect(listed).not.toContain('eg_site_settings')
      expect(listed).not.toContain('eg_tracking_events')
      expect(listed).not.toContain('eg_products')
      const events = report.tables.find((entry) => entry.table === 'eg_events')
      expect(events).toMatchObject({ rows: 0, featureLabel: 'Events', paymentRecord: false })
      const onReport = await listUnusedTables(db, { ...flagsOff, events: true })
      expect(onReport.tables.map((entry) => entry.table)).not.toContain('eg_events')
    })

    it('refuses core tables, a section that is on, unknown tables and payment records', async () => {
      const existing = await names()
      expect(refusalFor('eg_pages', existing, flagsOff)).toBe('core')
      expect(refusalFor('eg_migrations', existing, flagsOff)).toBe('core')
      expect(refusalFor('eg_seo_settings', existing, flagsOff)).toBe('core')
      expect(refusalFor('eg_events', existing, { ...flagsOff, events: true })).toBe('feature-on')
      expect(refusalFor('eg_nothing', existing, flagsOff)).toBe('unknown')
      expect(refusalFor('eg_events', existing, flagsOff)).toBeNull()
      // Payment records: provision the shop and check they stay refused.
      expect((await provisionFeature(d1, consoleLogger, 'ecommerce')).ok).toBe(true)
      const withShop = await names()
      for (const table of ['eg_orders', 'eg_orders_items', 'eg_transactions', 'eg_order_refunds', 'eg_gift_cards', 'eg_credit_ledger']) {
        expect(refusalFor(table, withShop, flagsOff), table).toBe('payment')
      }
      const db = cleanupDbFromD1(d1 as never)
      expect(await dropUnusedTable(db, flagsOff, 'eg_orders', 'eg_orders')).toMatchObject({ ok: false, reason: 'payment' })
      expect(await names()).toContain('eg_orders')
    }, 120_000)

    it('exports rows as JSON first, then deletes only when the exact name is typed', async () => {
      const db = cleanupDbFromD1(d1 as never)
      await d1.prepare("INSERT INTO eg_event_rsvps (name, email, updated_at, created_at) VALUES ('A', 'a@example.com', '2026-01-01', '2026-01-01')").run().catch((): undefined => undefined)
      const exported = await exportUnusedTable(db, flagsOff, 'eg_event_rsvps')
      expect(exported.ok).toBe(true)
      expect(JSON.parse(exported.json)).toMatchObject({ table: 'eg_event_rsvps' })

      expect(await dropUnusedTable(db, flagsOff, 'eg_event_rsvps', 'eg_event')).toMatchObject({ ok: false, reason: 'confirmation' })
      expect(await dropUnusedTable(db, { ...flagsOff, events: true }, 'eg_event_rsvps', 'eg_event_rsvps')).toMatchObject({ ok: false, reason: 'feature-on' })
      expect(await names()).toContain('eg_event_rsvps')

      const dropped = await dropUnusedTable(db, flagsOff, 'eg_event_rsvps', 'eg_event_rsvps')
      expect(dropped.ok).toBe(true)
      expect(await names()).not.toContain('eg_event_rsvps')
    })

    it('a section whose table was deleted gets it back when it is provisioned again, without stray copies', async () => {
      const { setFeatureState } = await import('@/migrations/schema/featureTablesState')
      await setFeatureState(d1, 'events', 'deferred')
      expect((await provisionFeature(d1, consoleLogger, 'events')).ok).toBe(true)
      const now = await names()
      expect(now).toContain('eg_event_rsvps')
      expect(now).not.toContain('event_rsvps')
      expect(now).not.toContain('events')
    }, 120_000)
  })

  it('an install that predates lazy sections keeps every section: nothing is held back', async () => {
    // Pretend this is an older production database: every table there, no state table, no record of the migration.
    expect(await provisionAllFeatures(d1)).toEqual([])
    const everything = await names()
    await d1.prepare('DROP TABLE `eg_feature_tables`').run()
    await d1.prepare("DELETE FROM eg_migrations WHERE name = '20270310_100000_feature_tables_state'").run()
    const outcome = await runInternalMigrate(d1, consoleLogger, { baseline: false })
    expect(outcome.errorCount).toBe(0)
    const states = await readFeatureTableStates(d1)
    expect(states.events).toBe('provisioned')
    expect(states.ecommerce).toBe('provisioned')
    expect(states.faq).toBe('provisioned')
    expect(Object.values(states).every((state) => state === 'provisioned')).toBe(true)
    expect(await names()).toEqual(expect.arrayContaining(everything.filter((table) => table !== 'eg_feature_tables')))
  }, 400_000)
})
