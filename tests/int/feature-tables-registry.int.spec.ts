// @vitest-environment node
// Every table in the full schema belongs to core or to exactly one feature, and the
// lazy-provisioning wrapper classifies statements the way the registry says.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { CORE_TABLE_BASES, DEFERRED_ON_FRESH_INSTALL, duplicateBaseClaims, isCoreTable, isPaymentRecordTable, normaliseTableName, ownerOfTable } from '@/features/featureTables'
import { FEATURES } from '@/features/registry'
import { consoleLogger } from '@/localapi/logger'
import { classifyStatement, deferTables } from '@/migrations/schema/deferredTables'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

describe('feature table registry', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let tables: string[] = []

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true })
    const rows = await proxy.env.D1.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()
    tables = (rows.results as { name: string }[]).map((row) => row.name)
  }, 280000)

  afterAll(async () => {
    await proxy?.dispose()
  })

  it('no base table is claimed by two features', () => {
    expect(duplicateBaseClaims()).toEqual([])
  })

  it('every table in the schema is core (listed) or belongs to exactly one feature', () => {
    const unclassified = tables.filter((table) => ownerOfTable(table) === 'core' && !isCoreTable(table))
    expect(unclassified).toEqual([])
  })

  it('a table never reads as both core-listed and feature-owned by accident', () => {
    // A feature base must not also be a core base, or the owner would be ambiguous to a reader.
    const featureBases = new Set(FEATURES.flatMap((feature) => feature.tables))
    expect(CORE_TABLE_BASES.filter((base) => featureBases.has(base))).toEqual([])
  })

  it('every declared feature base exists in the schema (no dead names)', () => {
    const present = new Set(tables.map(normaliseTableName))
    const missing = FEATURES.flatMap((feature) => feature.tables.filter((base) => !present.has(base)).map((base) => `${feature.key}:${base}`))
    expect(missing).toEqual([])
  })

  it('payment records are owned by the shop and flagged', () => {
    for (const table of ['eg_orders', 'eg_orders_items', 'eg_transactions', 'eg_order_refunds', 'eg_gift_cards', 'eg_credit_ledger']) {
      expect(isPaymentRecordTable(table)).toBe(true)
      expect(ownerOfTable(table)).toBe('ecommerce')
    }
    expect(isPaymentRecordTable('eg_products')).toBe(false)
  })

  it('classifies pre-rename and version-mirror names with their feature', () => {
    expect(ownerOfTable('posts')).toBe('blog')
    expect(ownerOfTable('_posts_v_rels')).toBe('blog')
    expect(ownerOfTable('_eg_events_v')).toBe('events')
    expect(ownerOfTable('eg_events_rels')).toBe('events')
    expect(ownerOfTable('eg_event_rsvps')).toBe('events')
    expect(ownerOfTable('eg_pages_blocks_product_grid')).toBe('core')
    expect(ownerOfTable('eg_seo_settings')).toBe('core')
  })

  it('reads the target table of each kind of statement', () => {
    expect(classifyStatement('CREATE TABLE IF NOT EXISTS `eg_redirects` (id integer)')).toEqual({ read: false, table: 'eg_redirects' })
    expect(classifyStatement('CREATE UNIQUE INDEX IF NOT EXISTS `eg_redirects_from_idx` ON `eg_redirects` (`a`)')).toEqual({ read: false, table: 'eg_redirects' })
    expect(classifyStatement('ALTER TABLE `eg_locked_documents_rels` ADD COLUMN `x` integer')).toEqual({ read: false, table: 'eg_locked_documents_rels' })
    expect(classifyStatement('INSERT INTO eg_migrations (name) VALUES (?)')).toEqual({ read: false, table: 'eg_migrations' })
    expect(classifyStatement('  SELECT name FROM sqlite_master')).toEqual({ read: true, table: null })
    expect(classifyStatement('PRAGMA table_info(`eg_posts`)')).toEqual({ read: true, table: null })
  })

  it('a held-back write reports success and a read of a missing table is empty', async () => {
    const { db, report } = deferTables(proxy.env.D1, () => ({ mode: 'skip', features: new Set(['events']) }))
    const result = await db.prepare('CREATE TABLE IF NOT EXISTS `eg_events_probe` (id integer)').run()
    expect(result.success).toBe(true)
    const check = await proxy.env.D1.prepare(`SELECT name FROM sqlite_master WHERE name='eg_events_probe'`).all()
    expect(check.results).toHaveLength(0)
    expect(report.held.events).toBe(1)
    const missing = await db.prepare('SELECT * FROM `eg_events_nothing_here`').all()
    expect(missing.results).toEqual([])
  })

  it('a fresh install defers exactly the default-off features that own tables', () => {
    const owning = FEATURES.filter((feature) => feature.tables.length > 0 && !feature.defaultEnabled).map((feature) => feature.key)
    expect(DEFERRED_ON_FRESH_INSTALL).toEqual(owning)
    expect(DEFERRED_ON_FRESH_INSTALL).not.toContain('tracking')
  })
})
