import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 29: digital asset manager. The tables are owned by the `dam` feature (created only when the section is switched
 * on, see src/features/registry.ts) and hold everything the library needs beyond the media document itself, so the
 * media collection is untouched: per-file details (status, rights, hash, metadata, visibility), folder records,
 * collections, custom metadata fields, versions, share links, the activity log, saved searches, rendition presets and
 * the settings row. Also adds the `features_dam` switch on Site Settings. Idempotent. Down is a no-op.
 */
export const DAM_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_media_assets\` (
  \`media_id\` integer PRIMARY KEY NOT NULL,
  \`status\` text NOT NULL DEFAULT 'approved',
  \`licence_type\` text NOT NULL DEFAULT '',
  \`licence_terms\` text NOT NULL DEFAULT '',
  \`credit\` text NOT NULL DEFAULT '',
  \`usage_notes\` text NOT NULL DEFAULT '',
  \`territory\` text NOT NULL DEFAULT '',
  \`release_note\` text NOT NULL DEFAULT '',
  \`licence_start\` text,
  \`licence_expiry\` text,
  \`embargo_until\` text,
  \`content_hash\` text NOT NULL DEFAULT '',
  \`exif_json\` text NOT NULL DEFAULT '',
  \`meta_json\` text NOT NULL DEFAULT '',
  \`search_text\` text NOT NULL DEFAULT '',
  \`visibility\` text NOT NULL DEFAULT 'public',
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_media_assets_hash_idx` ON `eg_media_assets` (`content_hash`)',
  'CREATE INDEX IF NOT EXISTS `eg_media_assets_status_idx` ON `eg_media_assets` (`status`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_folders\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`path\` text NOT NULL,
  \`color\` text NOT NULL DEFAULT '#888888',
  \`description\` text NOT NULL DEFAULT '',
  \`allowed_roles\` text NOT NULL DEFAULT '',
  \`alt_prefix\` text NOT NULL DEFAULT '',
  \`default_licence\` text NOT NULL DEFAULT '',
  \`visibility\` text NOT NULL DEFAULT 'inherit',
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_media_folders_path_idx` ON `eg_media_folders` (`path`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_collections\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`description\` text NOT NULL DEFAULT '',
  \`smart_query\` text NOT NULL DEFAULT '',
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_media_collection_items\` (
  \`collection_id\` integer NOT NULL,
  \`media_id\` integer NOT NULL,
  PRIMARY KEY (\`collection_id\`, \`media_id\`)
)`,
  'CREATE INDEX IF NOT EXISTS `eg_media_collection_items_media_idx` ON `eg_media_collection_items` (`media_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_meta_fields\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`label\` text NOT NULL,
  \`field_key\` text NOT NULL,
  \`type\` text NOT NULL DEFAULT 'text',
  \`options\` text NOT NULL DEFAULT '',
  \`required\` integer NOT NULL DEFAULT 0,
  \`searchable\` integer NOT NULL DEFAULT 1,
  \`applies_to\` text NOT NULL DEFAULT 'all',
  \`sort_order\` integer NOT NULL DEFAULT 0,
  \`updated_at\` text,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_media_meta_fields_key_idx` ON `eg_media_meta_fields` (`field_key`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_versions\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`media_id\` integer NOT NULL,
  \`r2_key\` text NOT NULL,
  \`filename\` text NOT NULL DEFAULT '',
  \`mime_type\` text NOT NULL DEFAULT '',
  \`filesize\` integer NOT NULL DEFAULT 0,
  \`width\` integer,
  \`height\` integer,
  \`content_hash\` text NOT NULL DEFAULT '',
  \`note\` text NOT NULL DEFAULT '',
  \`user_id\` integer,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_media_versions_media_idx` ON `eg_media_versions` (`media_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_shares\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`token_hash\` text NOT NULL,
  \`kind\` text NOT NULL DEFAULT 'file',
  \`target_id\` integer NOT NULL,
  \`expires_at\` text,
  \`password_hash\` text NOT NULL DEFAULT '',
  \`max_downloads\` integer NOT NULL DEFAULT 0,
  \`downloads\` integer NOT NULL DEFAULT 0,
  \`revoked\` integer NOT NULL DEFAULT 0,
  \`user_id\` integer,
  \`created_at\` text
)`,
  'CREATE UNIQUE INDEX IF NOT EXISTS `eg_media_shares_token_idx` ON `eg_media_shares` (`token_hash`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_activity\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`media_id\` integer NOT NULL,
  \`action\` text NOT NULL,
  \`detail\` text NOT NULL DEFAULT '',
  \`user_id\` integer,
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_media_activity_media_idx` ON `eg_media_activity` (`media_id`)',
  `CREATE TABLE IF NOT EXISTS \`eg_media_saved_searches\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`query_json\` text NOT NULL DEFAULT '{}',
  \`user_id\` integer,
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_media_renditions\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`width\` integer NOT NULL DEFAULT 0,
  \`height\` integer NOT NULL DEFAULT 0,
  \`fit\` text NOT NULL DEFAULT 'scale-down',
  \`format\` text NOT NULL DEFAULT 'auto',
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_media_dam_settings\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`strip_gps\` integer NOT NULL DEFAULT 1,
  \`auto_extract\` integer NOT NULL DEFAULT 1,
  \`keep_versions\` integer NOT NULL DEFAULT 5,
  \`block_used_delete\` integer NOT NULL DEFAULT 1,
  \`duplicate_action\` text NOT NULL DEFAULT 'warn',
  \`expiry_warn_days\` integer NOT NULL DEFAULT 30,
  \`require_approval\` integer NOT NULL DEFAULT 0,
  \`quota_mb\` integer NOT NULL DEFAULT 0
)`,
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of DAM_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_dam')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_dam` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables and column stay on rollback.
}
