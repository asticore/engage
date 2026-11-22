import { DEFAULT_QUESTION_SET, parseQuestionSet, type BlogQuestionSet } from './questionSets'

/** D1 access for `eg_blog_question_sets`. Rows that do not check out when read are skipped, never repaired. */
type Stmt = {
  bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> }
  all: <T>() => Promise<{ results: T[] }>
}
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

export async function listQuestionSets(d1: D1): Promise<BlogQuestionSet[]> {
  const res = await d1
    .prepare('SELECT id, name, post_type, questions, is_default FROM eg_blog_question_sets ORDER BY created_at, id LIMIT 50')
    .all<Row>()
  const out: BlogQuestionSet[] = []
  for (const row of res.results) {
    let questions: unknown = []
    try {
      questions = JSON.parse(String(row.questions ?? '[]')) as unknown
    } catch {
      continue
    }
    const parsed = parseQuestionSet({ id: row.id, name: row.name, postType: row.post_type, isDefault: Number(row.is_default) === 1, questions })
    if (parsed.ok) out.push(parsed.value)
  }
  return out
}

/** Writes the whole list: one batch of replace and delete, so the table always matches what the rules checked. */
export async function writeQuestionSets(d1: D1, sets: BlogQuestionSet[], nowIso: string): Promise<void> {
  const keep = new Set(sets.map((set) => set.id))
  const existing = await d1.prepare('SELECT id FROM eg_blog_question_sets').all<Row>()
  for (const row of existing.results) {
    const id = String(row.id)
    if (!keep.has(id)) await d1.prepare('DELETE FROM eg_blog_question_sets WHERE id = ?1').bind(id).run()
  }
  for (const set of sets) {
    await d1
      .prepare(
        'INSERT INTO eg_blog_question_sets (id, name, post_type, questions, is_default, created_at) VALUES (?1,?2,?3,?4,?5,?6) ' +
          'ON CONFLICT(id) DO UPDATE SET name = ?2, post_type = ?3, questions = ?4, is_default = ?5',
      )
      .bind(set.id, set.name, set.postType, JSON.stringify(set.questions), set.isDefault ? 1 : 0, nowIso)
      .run()
  }
}

export async function d1FromContext(): Promise<D1 | null> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare')
  const context = await getCloudflareContext({ async: true })
  return (context?.env?.D1 as unknown as D1 | undefined) ?? null
}

export { DEFAULT_QUESTION_SET }
