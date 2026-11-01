import type { ApprovalCollection } from './workflows'

/**
 * Closes the gap between the approval route's re-read and its write. The route claims the
 * document with a conditional update: the row is changed only while its `updated_at` still holds
 * the value the request read. Two requests that read the same version cannot both claim it; the
 * second finds no row and is refused with a 409. The claim also moves `updated_at`, so the
 * engine write that follows is the only one of the two that lands.
 *
 * Returns true when claimed, false when the document changed since it was read, and null when
 * no database is reachable (tests and tooling), in which case the caller goes on as before.
 */

const TABLES: Record<ApprovalCollection, string> = {
  pages: 'eg_pages',
  posts: 'eg_posts',
  events: 'eg_events',
  courses: 'eg_courses',
  products: 'eg_products',
}

/** The claim, as the route passes it to the review handler. */
export type ClaimFn = (collection: ApprovalCollection, id: number, expectedUpdatedAt: unknown, now: string) => Promise<boolean | null>

export async function claimDocumentWrite(collection: ApprovalCollection, id: number, expectedUpdatedAt: unknown, now: string): Promise<boolean | null> {
  const table = TABLES[collection]
  if (!table || typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt === '') return null
  try {
    const [{ getDb }, { sql }] = await Promise.all([import('@/cms/db/connect'), import('drizzle-orm')])
    const db = await getDb()
    const result = (await db.run(
      sql`UPDATE ${sql.raw(`\`${table}\``)} SET updated_at = ${now} WHERE id = ${id} AND updated_at = ${expectedUpdatedAt}`,
    )) as { meta?: { changes?: number } } | undefined
    const changes = result?.meta?.changes
    if (typeof changes !== 'number') return null
    return changes > 0
  } catch {
    return null
  }
}
