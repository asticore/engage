import { MigrateUpArgs, MigrateDownArgs } from '@/engine/db'

/**
 * Does nothing. Exists so a real release carries one new migration record, to prove the single update popup
 * shows "Finish update", runs it, and clears. Idempotent; down is a no-op.
 */
export async function up(_args?: MigrateUpArgs): Promise<void> {
  // Intentionally empty.
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // Nothing to undo.
}
