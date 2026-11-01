import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Adds the Error alerts group to the Speed settings global (src/globals/SpeedSettings.ts):
// the on/off switch and the threshold that the error spike alert reads
// (src/features/errors/spikeAlert.ts). Column names are what generate.ts produces for
// the group fields. Idempotent: each column is added only when it is missing.

type Runner = MigrateUpArgs['db']

const columnsOf = async (db: Runner, table: string): Promise<Set<string>> =>
  new Set(((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).map((r) => r.name))

const addMissing = async (db: Runner, table: string, column: string, type: string): Promise<void> => {
  const cols = await columnsOf(db, table)
  if (cols.size === 0) return
  if (!cols.has(column)) await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`))
}

const COLUMNS: [string, string][] = [
  ['error_alerts_enabled', 'integer DEFAULT true'],
  ['error_alerts_threshold', 'numeric DEFAULT 10'],
]

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const [column, type] of COLUMNS) {
    await addMissing(db, 'eg_speed_settings', column, type)
  }
  engine.logger.info('[migrate] error alert settings columns ensured.')
}

export async function down(_args: MigrateDownArgs): Promise<void> {}
