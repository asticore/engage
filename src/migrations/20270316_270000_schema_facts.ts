import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/** Task 21g: facts for the rich page types on pages and posts (and their version tables). Idempotent. Down is a no-op. */
const TARGETS: Array<[string, string]> = [
  ['eg_pages', 'schema_facts'],
  ['_eg_pages_v', 'version_schema_facts'],
  ['eg_posts', 'schema_facts'],
  ['_eg_posts_v', 'version_schema_facts'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [table, column] of TARGETS) {
    const tables = (await db.all(sql.raw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`))) as { name: string }[]
    if (tables.length === 0) continue
    const existing = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    if (!existing.some((c) => c.name === column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` text`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
