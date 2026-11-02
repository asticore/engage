import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * External embeds, phase 2: one row per embed of a form.
 *
 * `eg_form_embeds` holds each embed's own public key (the address /embed/<key> and the key the
 * submit endpoint takes), the source label that its submissions carry, the websites allowed to show
 * it, and its theme picks (colour, font and radius, all chosen from the site's design pickers, see
 * src/features/forms/embeds.ts). A form can have any number of embeds; forms are still built only in
 * the visual editor.
 *
 * Existing embeds are carried over: each form that had an embed key before gets one row with that same
 * key, so every snippet already placed on another website keeps working, with its switch and its
 * websites read from the old per-form settings (`formConfig.embed`).
 *
 * `eg_form_submissions` gets `embed_id` and `embed_source`, so an entry says which embed it came through.
 * Submissions from this site keep both empty. Everything here is idempotent: a table or column that
 * exists is left alone, and the copy only adds keys that no row has yet.
 * Mirror: src/cms/db/schema/formEmbeds.ts. Change one, change the other.
 */

const EMBEDS_TABLE = `CREATE TABLE IF NOT EXISTS \`eg_form_embeds\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`form_id\` integer NOT NULL REFERENCES \`eg_forms\`(\`id\`) ON DELETE CASCADE,
  \`name\` text NOT NULL,
  \`embed_key\` text NOT NULL,
  \`enabled\` integer DEFAULT 1 NOT NULL,
  \`allowed_origins\` text DEFAULT '[]' NOT NULL,
  \`theme\` text DEFAULT '{}' NOT NULL,
  \`created_at\` text NOT NULL,
  \`updated_at\` text NOT NULL
)`

const EMBEDS_KEY_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `eg_form_embeds_embed_key_idx` ON `eg_form_embeds` (`embed_key`)'
const EMBEDS_FORM_INDEX = 'CREATE INDEX IF NOT EXISTS `eg_form_embeds_form_id_idx` ON `eg_form_embeds` (`form_id`)'

// Copies each form's existing embed key into a row. The switch is off only when the old config turned it off;
// a missing or unreadable config means embedding was on, as it was before. The `NOT EXISTS` makes a second run a no-op.
const COPY_LEGACY_EMBEDS = `INSERT INTO \`eg_form_embeds\` (\`form_id\`, \`name\`, \`embed_key\`, \`enabled\`, \`allowed_origins\`, \`theme\`, \`created_at\`, \`updated_at\`)
SELECT \`f\`.\`id\`,
  COALESCE(NULLIF(\`f\`.\`title\`, ''), 'Website'),
  \`f\`.\`embed_key\`,
  CASE WHEN json_valid(\`f\`.\`form_config\`) THEN (CASE WHEN json_extract(\`f\`.\`form_config\`, '$.embed.enabled') = 0 THEN 0 ELSE 1 END) ELSE 1 END,
  CASE WHEN json_valid(\`f\`.\`form_config\`) THEN COALESCE(json_extract(\`f\`.\`form_config\`, '$.embed.allowedOrigins'), '[]') ELSE '[]' END,
  '{}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM \`eg_forms\` \`f\`
WHERE \`f\`.\`embed_key\` IS NOT NULL AND \`f\`.\`embed_key\` <> ''
  AND NOT EXISTS (SELECT 1 FROM \`eg_form_embeds\` \`e\` WHERE \`e\`.\`embed_key\` = \`f\`.\`embed_key\`)`

async function columnExists(db: MigrateUpArgs['db'], table: string, column: string): Promise<boolean> {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
  return rows.some((r) => r.name === column)
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  await db.run(sql.raw(EMBEDS_TABLE))
  await db.run(sql.raw(EMBEDS_KEY_INDEX))
  await db.run(sql.raw(EMBEDS_FORM_INDEX))
  await db.run(sql.raw(COPY_LEGACY_EMBEDS))

  const submissions = (await db.all(sql.raw("SELECT name FROM sqlite_master WHERE type='table' AND name='eg_form_submissions'"))) as { name: string }[]
  if (submissions.length > 0) {
    if (!(await columnExists(db, 'eg_form_submissions', 'embed_id'))) {
      await db.run(sql.raw('ALTER TABLE `eg_form_submissions` ADD COLUMN `embed_id` integer'))
    }
    if (!(await columnExists(db, 'eg_form_submissions', 'embed_source'))) {
      await db.run(sql.raw('ALTER TABLE `eg_form_submissions` ADD COLUMN `embed_source` text'))
    }
  }
  engine.logger.info('[migrate] eg_form_embeds is present and existing embed keys are carried over.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  // No-op, like the other column migrations: embeds already placed on other websites must keep working.
  engine.logger.info('[migrate] Down is a no-op - form embeds are left in place.')
}
