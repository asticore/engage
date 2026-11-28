/** "Was this helpful?" votes on FAQ answers: one vote per question and visitor (a later vote replaces the earlier one). */
type Stmt = {
  bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> }
}
export type VoteD1 = { prepare: (sql: string) => Stmt }

export type VoteInput = { id: number; helpful: boolean }

/** Reads and checks the request body. null when it is not a valid vote. */
export function parseVote(body: unknown): VoteInput | null {
  if (!body || typeof body !== 'object') return null
  const { id, helpful } = body as { id?: unknown; helpful?: unknown }
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return null
  if (typeof helpful !== 'boolean') return null
  return { id, helpful }
}

/** Hash of the visitor key and the question, so the table holds no address. */
export async function voterHash(visitorKey: string, faqId: number): Promise<string> {
  const data = new TextEncoder().encode(`faq-vote:${faqId}:${visitorKey}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function recordVote(d1: VoteD1, vote: VoteInput, voter: string, nowIso: string): Promise<void> {
  await d1
    .prepare(
      'INSERT INTO eg_faq_votes (faq_id, voter, helpful, created_at) VALUES (?1,?2,?3,?4) ' +
        'ON CONFLICT(faq_id, voter) DO UPDATE SET helpful = ?3, created_at = ?4',
    )
    .bind(vote.id, voter, vote.helpful ? 1 : 0, nowIso)
    .run()
}

export type VoteTotals = { yes: number; no: number }

/** Totals per question id, for the admin list. */
export async function voteTotals(d1: VoteD1): Promise<Record<number, VoteTotals>> {
  const res = await d1
    .prepare('SELECT faq_id, SUM(helpful) AS yes, COUNT(*) - SUM(helpful) AS no FROM eg_faq_votes WHERE created_at > ?1 GROUP BY faq_id')
    .bind('')
    .all<{ faq_id: number; yes: number; no: number }>()
  const out: Record<number, VoteTotals> = {}
  for (const row of res.results) out[Number(row.faq_id)] = { yes: Number(row.yes) || 0, no: Number(row.no) || 0 }
  return out
}
