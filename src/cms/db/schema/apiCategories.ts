import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle mirrors of the API category tables (hand-migrated: see
 * src/migrations/20270314_100000_api_categories.ts). Rows are written with bound statements by
 * src/features/apiKeys/categoryStore.ts. Column names must keep matching the migration.
 */
export const apiCategories = sqliteTable(
  'eg_api_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    scopes: text('scopes').notNull().default('[]'),
    ratePerMinute: integer('rate_per_minute').notNull().default(120),
    maxKeys: integer('max_keys').notNull().default(5),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('eg_api_categories_name_idx').on(table.name)],
)

export const apiCategoryMembers = sqliteTable(
  'eg_api_category_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('eg_api_category_members_subject_idx').on(table.subjectType, table.subjectId), index('eg_api_category_members_category_idx').on(table.categoryId)],
)

export const apiKeyUsage = sqliteTable(
  'eg_api_key_usage',
  {
    keyId: integer('key_id').notNull(),
    day: text('day').notNull(),
    requests: integer('requests').notNull().default(0),
    errors: integer('errors').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.keyId, table.day] })],
)
