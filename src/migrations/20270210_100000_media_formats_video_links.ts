import { MigrateUpArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Task 12b: output formats, video links and Stream video conversion.
 *
 * - eg_media_settings: the site image format (`optimisation_output_image_format`),
 *   the site video format and the Cloudflare Stream account id and API token
 *   (`video_*`). The token is stored encrypted like the stock photo keys.
 * - eg_media: a per-file output format, the poster picture of a video link,
 *   and the Stream upload id and conversion status used by Optimise on video.
 *
 * Idempotent: each column is checked before it is added, so a fresh install
 * (where the schema already has them) and an upgrade both succeed, and a second
 * run changes nothing. Down is a no-op, as for the other media migrations.
 */

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

const MEDIA_COLUMNS: Array<[column: string, definition: string]> = [
  ['output_format', "TEXT DEFAULT 'default'"],
  ['poster_id', 'integer'],
  ['stream_uid', 'TEXT'],
  ['conversion_status', 'TEXT'],
]

const MEDIA_SETTINGS_COLUMNS: Array<[column: string, definition: string]> = [
  ['optimisation_output_image_format', "TEXT DEFAULT 'switches'"],
  ['video_output_format', "TEXT DEFAULT 'original'"],
  ['video_stream_account_id', 'TEXT'],
  ['video_stream_api_token', 'TEXT'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [column, definition] of MEDIA_COLUMNS) {
    if (!(await columnExists(db, 'eg_media', column))) {
      await db.run(sql.raw(`ALTER TABLE \`eg_media\` ADD COLUMN \`${column}\` ${definition}`))
    }
  }
  for (const [column, definition] of MEDIA_SETTINGS_COLUMNS) {
    if (!(await columnExists(db, 'eg_media_settings', column))) {
      await db.run(sql.raw(`ALTER TABLE \`eg_media_settings\` ADD COLUMN \`${column}\` ${definition}`))
    }
  }
}

export async function down(): Promise<void> {
  // SQLite does not support DROP COLUMN; the columns are left in place.
}
