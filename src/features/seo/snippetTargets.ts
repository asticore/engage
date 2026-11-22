import { sql } from 'drizzle-orm'

import type { Drizzle } from '@/localapi/migrate'

import { isSnippetId } from './snippets'

/** The snippet types an author ticked for a page (table `eg_seo_snippet_targets`). Never throws on bad stored data. */

export async function readTargets(db: Drizzle, collection: string, docId: number): Promise<string[]> {
  const rows = (await db.all(sql`SELECT types FROM \`eg_seo_snippet_targets\` WHERE collection = ${collection} AND doc_id = ${docId}`)) as { types: string }[]
  try {
    const parsed = JSON.parse(rows[0]?.types ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter(isSnippetId) : []
  } catch {
    return []
  }
}

export async function writeTargets(db: Drizzle, collection: string, docId: number, types: string[]): Promise<string[]> {
  const clean = [...new Set(types.filter(isSnippetId))]
  await db.run(sql`INSERT INTO \`eg_seo_snippet_targets\` (collection, doc_id, types) VALUES (${collection}, ${docId}, ${JSON.stringify(clean)})
    ON CONFLICT(collection, doc_id) DO UPDATE SET types = excluded.types`)
  return clean
}
