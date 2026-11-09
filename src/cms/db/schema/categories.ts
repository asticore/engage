import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle mirror of `eg_categories` and `eg_category_links` (hand-migrated: see
 * src/migrations/20270313_100000_categories.ts). Read and written by src/features/categories/store.ts.
 */
export const categories = sqliteTable(
  'eg_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }).notNull(),
    scope: text('scope').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    parentId: integer('parent_id'),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('eg_categories_scope_slug_idx').on(t.scope, t.slug), index('eg_categories_parent_idx').on(t.parentId)],
)

export const categoryLinks = sqliteTable(
  'eg_category_links',
  {
    categoryId: integer('category_id').notNull(),
    scope: text('scope').notNull(),
    docId: integer('doc_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.docId] }), index('eg_category_links_doc_idx').on(t.scope, t.docId)],
)
