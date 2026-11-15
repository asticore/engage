import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 19b: media tags. Two tables owned by the `mediatags` feature (created only when the section is switched on, see
 * src/features/registry.ts): the tag tree and the file-to-tag links. Also the `features_mediatags` switch on Site
 * Settings. Idempotent. Down is a no-op.
 */
export const MEDIA_TAGS_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_media_tags\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`parent_id\` integer,
  \`color\` text NOT NULL DEFAULT '#888888',
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_media_tag_links\` (
  \`media_id\` integer NOT NULL,
  \`tag_id\` integer NOT NULL,
  PRIMARY KEY (\`media_id\`, \`tag_id\`)
)`,
  'CREATE INDEX IF NOT EXISTS `eg_media_tags_parent_idx` ON `eg_media_tags` (`parent_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_media_tag_links_tag_idx` ON `eg_media_tag_links` (`tag_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of MEDIA_TAGS_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_mediatags')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_mediatags` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
