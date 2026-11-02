import { MigrateUpArgs, sql } from '@/engine/db'
import { fetchFontsourceVersion, pinLegacyFontEntries } from '@/features/fonts/install'

type Runner = MigrateUpArgs['db']

/**
 * Known-limits sweep (Fonts): fonts installed before 1 Nov 2026 have no pinned
 * version, so their files load from jsDelivr's unpinned @latest path and can
 * change under the site. This pins each remote Fontsource font in
 * theme_custom_fonts to the version jsDelivr reports as latest, the version a new
 * install gets, and leaves every other entry as it was.
 *
 * A font whose version cannot be read (jsDelivr unreachable) keeps its old path
 * and is left for a later run. Idempotent: an entry that already has a version is
 * skipped. Down is a no-op.
 */

const columnExists = async (db: Runner, table: string, column: string): Promise<boolean> => {
  try {
    const rows = (await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]
    return rows.some((r) => r.name === column)
  } catch {
    return false
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'eg_site_settings', 'theme_custom_fonts'))) return

  const rows = (await db.all(sql`SELECT id, theme_custom_fonts AS fonts FROM eg_site_settings`)) as { id: number; fonts: string | null }[]
  for (const row of rows) {
    if (typeof row.fonts !== 'string' || !row.fonts.includes('"fontsource"')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(row.fonts)
    } catch {
      continue
    }
    if (!Array.isArray(parsed)) continue
    const { entries, pinned } = await pinLegacyFontEntries(parsed, (id) => fetchFontsourceVersion(id))
    if (pinned === 0) continue
    await db.run(sql`UPDATE eg_site_settings SET theme_custom_fonts = ${JSON.stringify(entries)} WHERE id = ${row.id}`)
  }
}

export async function down(): Promise<void> {
  // Nothing to undo: the pinned versions are kept.
}
