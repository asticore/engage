import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle mirror of `eg_form_embeds` (hand-migrated: see src/migrations/20270306_100000_form_embeds.ts).
 * One row per embed of a form: its public key, source label, websites allowed and theme picks.
 * Read and written by src/features/forms/embeds.ts.
 */
export const formEmbeds = sqliteTable('eg_form_embeds', {
  id: integer('id').primaryKey().notNull(),
  formId: integer('form_id').notNull(),
  name: text('name').notNull(),
  embedKey: text('embed_key').notNull(),
  enabled: integer('enabled').notNull().default(1),
  allowedOrigins: text('allowed_origins').notNull().default('[]'),
  theme: text('theme').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
