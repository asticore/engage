import { MigrateUpArgs, sql } from '@/engine/db'

/**
 * Admin: removes the rows the earlier closed-list version of the edit screen saved under the preference
 * key `edit-screen-collapse`. The current code reads `edit-screen-open` only, so those rows were never read
 * and only took up space. Idempotent: a second run deletes nothing. A missing table (a fresh install that
 * has not created preferences yet) is skipped.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  try {
    await db.run(sql.raw("DELETE FROM `eg_preferences` WHERE `key` = 'edit-screen-collapse'"))
  } catch {
    // no preferences table yet: nothing to clean up
  }
}

export async function down(): Promise<void> {
  // Deleted rows are not restored.
}
