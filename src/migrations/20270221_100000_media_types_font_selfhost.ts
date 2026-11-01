import { MigrateUpArgs, sql } from '@/engine/db'

type Runner = MigrateUpArgs['db']

/**
 * Known-limits sweep (Media, Fonts): the file types added this round and the
 * built-in font self-host switch.
 *
 * - eg_speed_settings.fonts_self_host_built_in_fonts: serve the theme's built-in
 *   fonts from this site (copied from npm once) instead of from jsDelivr.
 * - eg_media_settings.uploads_allowed_extensions: the new types (ico, heic, bmp,
 *   tiff, ods, json, rtf, ogg, m4a) are appended to a saved list so existing sites
 *   accept them. Only types missing from the list are added; a blank list stays
 *   blank, which already means the whole default list.
 *
 * Idempotent: the column is checked before it is added, and a type already in the
 * list is not added again. Down is a no-op, as for the other media migrations.
 */

const NEW_EXTENSIONS = ['ico', 'heic', 'bmp', 'tiff', 'ods', 'json', 'rtf', 'ogg', 'm4a']

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'eg_speed_settings', 'fonts_self_host_built_in_fonts'))) {
    await db.run(sql.raw('ALTER TABLE `eg_speed_settings` ADD COLUMN `fonts_self_host_built_in_fonts` integer DEFAULT false'))
  }

  if (await columnExists(db, 'eg_media_settings', 'uploads_allowed_extensions')) {
    const rows = (await db.all(sql.raw('SELECT `uploads_allowed_extensions` AS list FROM `eg_media_settings`'))) as { list: string | null }[]
    for (const row of rows) {
      const current = typeof row.list === 'string' ? row.list.trim() : ''
      if (!current) continue
      const present = new Set(current.split(/[\s,;]+/).map((item) => item.replace(/^\*?\./, '').toLowerCase()))
      const missing = NEW_EXTENSIONS.filter((extension) => !present.has(extension))
      if (missing.length === 0) continue
      const updated = `${current}, ${missing.join(', ')}`.replace(/'/g, "''")
      await db.run(sql.raw(`UPDATE \`eg_media_settings\` SET \`uploads_allowed_extensions\` = '${updated}'`))
    }
  }
}

export async function down(): Promise<void> {
  // SQLite does not support DROP COLUMN; the column is left in place.
}
