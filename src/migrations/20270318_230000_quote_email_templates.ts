import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

/**
 * Task 12c: the quotes and requests emails become editable in Email templates and the email designer. Eight more wording
 * groups (subject and body) and eight design columns on `eg_email_templates`, named as src/cms/db/schema/generate.ts names
 * the groups in src/globals/EmailTemplates.ts. Idempotent: a column is only added when PRAGMA table_info says it is missing
 * and the table is there. Down is a no-op.
 */
export const QUOTE_EMAIL_KEYS = ['quote_received', 'quote_admin_new', 'quote_sent', 'quote_expiring', 'quote_bid_lost', 'quote_counter', 'quote_accepted', 'quote_declined'] as const

/** The columns in the order they are added: wording first, then designs. */
export const QUOTE_EMAIL_COLUMNS: string[] = [...QUOTE_EMAIL_KEYS.flatMap((key) => [`${key}_subject`, `${key}_body`]), ...QUOTE_EMAIL_KEYS.map((key) => `${key}_design`)]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const have = new Set(((await db.all(sql.raw('PRAGMA table_info(`eg_email_templates`)'))) as { name: string }[]).map((r) => r.name))
  if (have.size === 0) return
  for (const column of QUOTE_EMAIL_COLUMNS) {
    if (!have.has(column)) await db.run(sql.raw(`ALTER TABLE \`eg_email_templates\` ADD COLUMN \`${column}\` text`))
  }
}

export async function down(_args?: MigrateDownArgs): Promise<void> {
  // The columns stay on rollback.
}
