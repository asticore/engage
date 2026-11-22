/** Counters for the Spam folders (Task 5, 21b): what is being held, total and in the last 7 days. */
type D1Like = { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> }; first<T>(): Promise<T | null> } }

export type SpamCounts = { forms: number; formsWeek: number; reviews: number; reviewsWeek: number; comments: number; commentsWeek: number }

const count = async (db: D1Like, sql: string, since: string): Promise<number> => {
  try {
    const row = await db.prepare(sql).bind(since).first<{ n: number }>()
    return Number(row?.n ?? 0)
  } catch {
    return 0
  }
}

export async function loadSpamCounts(db: D1Like, now: Date): Promise<SpamCounts> {
  const week = new Date(now.getTime() - 7 * 86400000).toISOString()
  const all = '0000'
  const [forms, formsWeek, reviews, reviewsWeek, comments, commentsWeek] = await Promise.all([
    count(db, "SELECT COUNT(*) AS n FROM `eg_form_submissions` WHERE status = 'spam' AND created_at >= ?", all),
    count(db, "SELECT COUNT(*) AS n FROM `eg_form_submissions` WHERE status = 'spam' AND created_at >= ?", week),
    count(db, "SELECT COUNT(*) AS n FROM `eg_product_reviews` WHERE status = 'spam' AND created_at >= ?", all),
    count(db, "SELECT COUNT(*) AS n FROM `eg_product_reviews` WHERE status = 'spam' AND created_at >= ?", week),
    count(db, "SELECT COUNT(*) AS n FROM `eg_comments` WHERE status = 'spam' AND created_at >= ?", all),
    count(db, "SELECT COUNT(*) AS n FROM `eg_comments` WHERE status = 'spam' AND created_at >= ?", week),
  ])
  return { forms, formsWeek, reviews, reviewsWeek, comments, commentsWeek }
}

/** One plain sentence, or empty when nothing is held. */
export function describeSpamCounts(c: SpamCounts): string {
  const parts: string[] = []
  if (c.forms) parts.push(`${c.forms} form entr${c.forms === 1 ? 'y' : 'ies'} (${c.formsWeek} this week)`)
  if (c.reviews) parts.push(`${c.reviews} product review${c.reviews === 1 ? '' : 's'} (${c.reviewsWeek} this week)`)
  if (c.comments) parts.push(`${c.comments} comment${c.comments === 1 ? '' : 's'} (${c.commentsWeek} this week)`)
  return parts.length ? `Held as spam: ${parts.join(', ')}. Open Form entries, Product reviews or Comments and choose the Spam view to release one.` : ''
}
