import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 15: the taskboard (Kanban). Five tables owned by the `taskboard` feature (created only when the
 * section is switched on, see src/features/registry.ts): boards, their columns, cards, comments and an
 * activity trail for moves and assignments. Also the `features_taskboard` switch on Site Settings.
 * Idempotent. Down is a no-op.
 */
export const TASKBOARD_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`eg_task_boards\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`name\` text NOT NULL,
  \`member_ids\` text NOT NULL DEFAULT '[]',
  \`created_by\` integer,
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_task_columns\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`board_id\` integer NOT NULL,
  \`name\` text NOT NULL,
  \`position\` integer NOT NULL DEFAULT 0
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_task_cards\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`board_id\` integer NOT NULL,
  \`column_id\` integer NOT NULL,
  \`title\` text NOT NULL,
  \`description\` text NOT NULL DEFAULT '',
  \`assignee_id\` integer,
  \`due_date\` text,
  \`labels\` text NOT NULL DEFAULT '[]',
  \`priority\` text NOT NULL DEFAULT 'normal',
  \`position\` integer NOT NULL DEFAULT 0,
  \`created_by\` integer,
  \`updated_at\` text,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_task_comments\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`card_id\` integer NOT NULL,
  \`user_id\` integer,
  \`body\` text NOT NULL,
  \`created_at\` text
)`,
  `CREATE TABLE IF NOT EXISTS \`eg_task_activity\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  \`board_id\` integer NOT NULL,
  \`card_id\` integer,
  \`user_id\` integer,
  \`action\` text NOT NULL,
  \`detail\` text NOT NULL DEFAULT '',
  \`created_at\` text
)`,
  'CREATE INDEX IF NOT EXISTS `eg_task_columns_board_idx` ON `eg_task_columns` (`board_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_task_cards_board_idx` ON `eg_task_cards` (`board_id`, `column_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_task_cards_assignee_idx` ON `eg_task_cards` (`assignee_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_task_comments_card_idx` ON `eg_task_comments` (`card_id`)',
  'CREATE INDEX IF NOT EXISTS `eg_task_activity_board_idx` ON `eg_task_activity` (`board_id`)',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const statement of TASKBOARD_STATEMENTS) await db.run(sql.raw(statement))
  const tables = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' AND name='eg_site_settings'`)) as { name: string }[]
  if (tables.length === 0) return
  const existing = (await db.all(sql.raw('PRAGMA table_info(`eg_site_settings`)'))) as { name: string }[]
  if (!existing.some((r) => r.name === 'features_taskboard')) {
    await db.run(sql.raw('ALTER TABLE `eg_site_settings` ADD COLUMN `features_taskboard` integer DEFAULT false'))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The tables stay on rollback.
}
