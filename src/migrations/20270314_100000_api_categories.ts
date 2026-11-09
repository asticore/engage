import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// API access categories (Task 10). An admin defines categories (for example partner, customer,
// internal). Each holds the scopes its people may use, a rate limit per key and a cap on keys.
//   1. `eg_api_categories`, one row per category. Scopes are a JSON array of `collection:action`.
//   2. `eg_api_category_members`, who is in which category: a person (`user`) or a customer
//      organisation (`organization`). One category per subject. A person's own row wins over
//      their organisation's row.
//   3. `eg_api_key_usage`, one row per key per day with request and error counts. No bodies, no keys.
// Idempotent: IF NOT EXISTS everywhere. Registered last in src/migrations/index.ts.

export const API_CATEGORIES_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_api_categories\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`scopes\` text DEFAULT '[]' NOT NULL,
  \`rate_per_minute\` integer DEFAULT 120 NOT NULL,
  \`max_keys\` integer DEFAULT 5 NOT NULL,
  \`created_at\` text NOT NULL,
  \`updated_at\` text NOT NULL
)`

export const API_CATEGORY_MEMBERS_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_api_category_members\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`category_id\` integer NOT NULL,
  \`subject_type\` text NOT NULL,
  \`subject_id\` integer NOT NULL,
  \`created_at\` text NOT NULL
)`

export const API_KEY_USAGE_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_api_key_usage\` (
  \`key_id\` integer NOT NULL,
  \`day\` text NOT NULL,
  \`requests\` integer DEFAULT 0 NOT NULL,
  \`errors\` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (\`key_id\`, \`day\`)
)`

export const API_CATEGORY_INDEXES = [
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_api_categories_name_idx` ON `eg_api_categories` (`name` COLLATE NOCASE)',
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_api_category_members_subject_idx` ON `eg_api_category_members` (`subject_type`, `subject_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_api_category_members_category_idx` ON `eg_api_category_members` (`category_id`)',
]

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(API_CATEGORIES_TABLE))
  await db.run(sql.raw(API_CATEGORY_MEMBERS_TABLE))
  await db.run(sql.raw(API_KEY_USAGE_TABLE))
  for (const statement of API_CATEGORY_INDEXES) {
    await db.run(sql.raw(statement))
  }
  engine.logger.info('[migrate] API category tables and eg_api_key_usage are present.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  // No-op like the other migrations: the tables are left in place.
  engine.logger.info('[migrate] Down is a no-op - API category tables are left in place.')
}
