import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Task 6 (16n, 16o): the site audit crawl (runs and one row per page), the target snippet picker, the crawl schedule
// setting, and the full PageSpeed checklist column on the stored results. Idempotent: every statement can be replayed.

type Runner = MigrateUpArgs['db']

const TABLES = [
  `CREATE TABLE IF NOT EXISTS \`eg_seo_crawl_runs\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`status\` text DEFAULT 'running' NOT NULL,
  \`source\` text DEFAULT 'manual' NOT NULL,
  \`started_at\` text NOT NULL,
  \`finished_at\` text,
  \`total\` integer DEFAULT 0 NOT NULL,
  \`done\` integer DEFAULT 0 NOT NULL,
  \`health\` integer,
  \`errors\` integer DEFAULT 0 NOT NULL,
  \`warnings\` integer DEFAULT 0 NOT NULL,
  \`notices\` integer DEFAULT 0 NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_seo_crawl_pages\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`run_id\` integer NOT NULL,
  \`path\` text NOT NULL,
  \`collection\` text,
  \`doc_id\` integer,
  \`in_sitemap\` integer DEFAULT 0 NOT NULL,
  \`state\` text DEFAULT 'pending' NOT NULL,
  \`status_code\` integer,
  \`response_ms\` integer,
  \`redirect_to\` text,
  \`redirect_hops\` integer DEFAULT 0 NOT NULL,
  \`bytes\` integer,
  \`data\` text,
  \`issues\` text,
  \`depth\` integer,
  \`in_links\` integer DEFAULT 0 NOT NULL,
  \`out_internal\` integer DEFAULT 0 NOT NULL,
  \`out_external\` integer DEFAULT 0 NOT NULL,
  \`broken_links\` integer DEFAULT 0 NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_seo_crawl_config\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`schedule\` text DEFAULT 'off' NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_seo_snippet_targets\` (
  \`collection\` text NOT NULL,
  \`doc_id\` integer NOT NULL,
  \`types\` text DEFAULT '[]' NOT NULL,
  PRIMARY KEY (\`collection\`, \`doc_id\`)
)`,
]

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS `eg_seo_crawl_pages_run_idx` ON `eg_seo_crawl_pages` (`run_id`, `state`)',
]

const addMissing = async (db: Runner, table: string, column: string, type: string): Promise<void> => {
  const info = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  if (info.length === 0) return
  if (!info.some((r) => r.name === column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const statement of TABLES) await db.run(sql.raw(statement))
  for (const statement of INDEXES) await db.run(sql.raw(statement))
  // The full PageSpeed checklist (every audit of the four categories) next to the trimmed suggestions.
  await addMissing(db, 'eg_pagespeed_results', 'audits', 'text')
  engine.logger.info('[migrate] SEO site audit tables ensured.')
}

export async function down(_args: MigrateDownArgs): Promise<void> {}
