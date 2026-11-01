import { MigrateUpArgs, MigrateDownArgs, sql } from '@/engine/db'

// Domain-scoped content, one time (replaces the manual re-save of content scoped before 29 Oct):
// 1. "Available on domains" is rewritten in the delimited form ",a.com,b.com," on pages, posts, products and their
//    version copies. Older rows were stored as plain comma lists, which the `contains ,host,` filter never matched.
//    Blank becomes null (all domains). Rows already in the form are left alone.
// 2. Post and product slugs are unique per domain scope. Among rows with the same scope and slug the lowest id keeps
//    the slug and the others get "-<id>" added, so the unique index below can be created.
// 3. The unique index on (scope, slug) is created for posts and products. Overlapping scopes (a.com,b.com against a.com)
//    are still checked by the slug validator (features/domains/slugs.ts), since a plain index cannot express them.
// Idempotent: a second run changes no rows and the index is created IF NOT EXISTS. A missing table is skipped.
// Registered in src/migrations/index.ts.

type Runner = MigrateUpArgs['db']

const SCOPED: { table: string; column: string }[] = [
  { table: 'eg_pages', column: 'available_domains' },
  { table: '_eg_pages_v', column: 'version_available_domains' },
  { table: 'eg_posts', column: 'available_domains' },
  { table: '_eg_posts_v', column: 'version_available_domains' },
  { table: 'eg_products', column: 'available_domains' },
  { table: '_eg_products_v', column: 'version_available_domains' },
]

const SLUG_UNIQUE: { table: string; index: string }[] = [
  { table: 'eg_posts', index: 'eg_posts_scope_slug_uidx' },
  { table: 'eg_products', index: 'eg_products_scope_slug_uidx' },
]

const quote = (value: string | number): string => `'${String(value).replace(/'/g, "''")}'`

const tableHas = async (db: Runner, table: string, column: string): Promise<boolean> =>
  ((await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))) as { name: string }[]).some((c) => c.name === column)

/** The delimited form of a stored list, or null for an empty one. Idempotent. */
export function normaliseScope(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const hosts = value
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
    .filter(Boolean)
  const unique = Array.from(new Set(hosts))
  return unique.length > 0 ? `,${unique.join(',')},` : null
}

export async function up({ db, engine }: MigrateUpArgs): Promise<void> {
  for (const { table, column } of SCOPED) {
    if (!(await tableHas(db, table, column))) continue
    const rows = (await db.all(sql.raw(`SELECT id, \`${column}\` AS scope FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`))) as {
      id: number
      scope: string | null
    }[]
    for (const row of rows) {
      const next = normaliseScope(row.scope)
      if (next !== row.scope) {
        await db.run(sql.raw(`UPDATE \`${table}\` SET \`${column}\` = ${next === null ? 'NULL' : quote(next)} WHERE id = ${row.id}`))
      }
    }
  }

  for (const { table, index } of SLUG_UNIQUE) {
    const column = 'available_domains'
    if (!(await tableHas(db, table, 'slug'))) continue
    const rows = (await db.all(
      sql.raw(`SELECT id, slug, COALESCE(\`${column}\`, '') AS scope FROM \`${table}\` WHERE slug IS NOT NULL ORDER BY id`),
    )) as { id: number; slug: string; scope: string }[]
    const taken = new Set<string>()
    for (const row of rows) {
      let slug = row.slug
      if (taken.has(`${row.scope}\u0000${slug}`)) {
        let attempt = `${row.slug}-${row.id}`
        let n = 2
        while (taken.has(`${row.scope}\u0000${attempt}`)) attempt = `${row.slug}-${row.id}-${n++}`
        slug = attempt
        await db.run(sql.raw(`UPDATE \`${table}\` SET slug = ${quote(slug)} WHERE id = ${row.id}`))
      }
      taken.add(`${row.scope}\u0000${slug}`)
    }
    await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS \`${index}\` ON \`${table}\` (COALESCE(\`${column}\`, ''), \`slug\`)`))
  }
  engine.logger.info('[migrate] Domain scopes are in the delimited form, and post and product slugs are unique per domain.')
}

export async function down({ engine }: MigrateDownArgs): Promise<void> {
  engine.logger.info('[migrate] Down is a no-op - the scope rows and the slug indexes are left in place.')
}
