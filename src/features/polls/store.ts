import { resolveD1Binding } from '@/cms/db/connect'

/** Poll votes, in a table created on first use (no migration). One vote per poll and voter id. */

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<unknown> }
export type PollD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

let ensured: Promise<void> | null = null
export async function pollDb(): Promise<PollD1> {
  const d1 = (await resolveD1Binding()) as unknown as PollD1
  if (!ensured) {
    ensured = (async () => {
      await d1.prepare('CREATE TABLE IF NOT EXISTS eg_poll_votes (poll_id TEXT NOT NULL, voter TEXT NOT NULL, choice INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (poll_id, voter))').bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}

export async function countVotes(db: PollD1, pollId: string): Promise<{ choice: number; n: number }[]> {
  const r = await db.prepare('SELECT choice, COUNT(*) AS n FROM eg_poll_votes WHERE poll_id = ?1 GROUP BY choice').bind(pollId).all<{ choice: number; n: number }>()
  return r.results ?? []
}

export async function votedChoice(db: PollD1, pollId: string, voter: string): Promise<number | null> {
  const r = await db.prepare('SELECT choice FROM eg_poll_votes WHERE poll_id = ?1 AND voter = ?2').bind(pollId, voter).first<{ choice: number }>()
  return r ? Number(r.choice) : null
}

/** Records the vote when this voter has none yet. Returns false when they had already voted. */
export async function castVote(db: PollD1, pollId: string, voter: string, choice: number, at: string): Promise<boolean> {
  if ((await votedChoice(db, pollId, voter)) !== null) return false
  await db.prepare('INSERT OR IGNORE INTO eg_poll_votes (poll_id, voter, choice, at) VALUES (?1, ?2, ?3, ?4)').bind(pollId, voter, choice, at).run()
  return true
}
