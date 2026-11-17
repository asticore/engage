import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Bid mode moves from two columns per table to one JSON column `bid` ({ minimum, endsAt }), because
 * `_eg_products_v` hit D1's 100-column limit. Copies existing values, then drops the old columns.
 * Idempotent. Down is a no-op.
 */
const TABLES: [string, string, string, string][] = [
  ['eg_products', 'bid', 'bid_minimum', 'bid_ends_at'],
  ['_eg_products_v', 'version_bid', 'version_bid_minimum', 'version_bid_ends_at'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, json, min, ends] of TABLES) {
    const cols = async (): Promise<Set<string>> => new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))
    const have = await cols()
    if (have.size === 0) continue
    const tmp = `${table}_bid_tmp`
    if (have.has(min) && have.has(ends)) {
      // Stash the values in a side table: a full table has no room for the new column until the old ones are gone.
      await db.run(sql.raw(`DROP TABLE IF EXISTS \`${tmp}\``))
      await db.run(sql.raw(`CREATE TABLE \`${tmp}\` AS SELECT id, \`${min}\` AS minimum, \`${ends}\` AS ends_at FROM \`${table}\` WHERE \`${min}\` IS NOT NULL OR \`${ends}\` IS NOT NULL`))
      await db.run(sql.raw(`ALTER TABLE \`${table}\` DROP COLUMN \`${min}\``))
      await db.run(sql.raw(`ALTER TABLE \`${table}\` DROP COLUMN \`${ends}\``))
    }
    if (!(await cols()).has(json)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${json}\` text`))
    const stashed = ((await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tmp}'`))) as unknown[]).length > 0
    if (stashed) {
      await db.run(sql.raw(`UPDATE \`${table}\` SET \`${json}\` = (SELECT json_object('minimum', t.minimum, 'endsAt', t.ends_at) FROM \`${tmp}\` t WHERE t.id = \`${table}\`.id) WHERE \`${json}\` IS NULL AND id IN (SELECT id FROM \`${tmp}\`)`))
      await db.run(sql.raw(`DROP TABLE \`${tmp}\``))
    }
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
