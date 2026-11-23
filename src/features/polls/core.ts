/** Pure poll rules (Task 15, 34g2): ids, choice limits and result maths. No storage here, so they are unit tested. */

export const MAX_OPTIONS = 12
export const VOTER_COOKIE = 'eg_poll_voter'

/** A poll id is letters, digits, dashes and underscores only, so it is safe as a key. */
export const cleanPollId = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null
}

export const cleanChoice = (v: unknown, optionCount = MAX_OPTIONS): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n < Math.min(optionCount, MAX_OPTIONS) ? n : null
}

export type PollResults = { counts: number[]; total: number }

export function toResults(rows: { choice: number; n: number }[], optionCount: number): PollResults {
  const counts = Array.from({ length: Math.min(optionCount, MAX_OPTIONS) }, () => 0)
  for (const r of rows) if (r.choice >= 0 && r.choice < counts.length) counts[r.choice] += r.n
  return { counts, total: counts.reduce((a, b) => a + b, 0) }
}

export const percent = (count: number, total: number): number => (total > 0 ? Math.round((count / total) * 100) : 0)
