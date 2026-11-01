import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle mirror of `eg_email_suppressions` (hand-migrated: see
 * src/migrations/20270129_100000_email_suppressions.ts). One row per address that
 * must not get reminder or marketing mail. Read and written by
 * src/features/email/suppression.ts.
 */
export const emailSuppressions = sqliteTable('eg_email_suppressions', {
  email: text('email').primaryKey().notNull(),
  reason: text('reason').notNull(),
  source: text('source'),
  createdAt: text('created_at').notNull(),
})
