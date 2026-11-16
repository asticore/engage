import { cleanSettings, DEFAULT_COMMENT_SETTINGS, type CommentSettings, type CommentStatus, type PublicComment } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const toStatus = (v: unknown): CommentStatus => (v === 'approved' || v === 'spam' || v === 'trash' ? v : 'pending')

export async function getSettings(d1: D1): Promise<CommentSettings> {
  try {
    const r = (await all(d1, 'SELECT mode, signed_in_auto, max_depth, close_after_days, blocked_words FROM eg_comment_settings WHERE id = 1'))[0]
    if (!r) return DEFAULT_COMMENT_SETTINGS
    return cleanSettings({ mode: r.mode, signedInAuto: Number(r.signed_in_auto ?? 0) === 1, maxDepth: r.max_depth, closeAfterDays: r.close_after_days, blockedWords: r.blocked_words })
  } catch {
    return DEFAULT_COMMENT_SETTINGS
  }
}

export async function saveSettings(d1: D1, s: CommentSettings): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_comment_settings (id, mode, signed_in_auto, max_depth, close_after_days, blocked_words) VALUES (1,?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET mode=?1, signed_in_auto=?2, max_depth=?3, close_after_days=?4, blocked_words=?5')
    .bind(s.mode, s.signedInAuto ? 1 : 0, s.maxDepth, s.closeAfterDays, s.blockedWords)
    .run()
}

/** Approved comments for one post, oldest first. No email or address ever leaves here. */
export async function approvedFor(d1: D1, refType: string, refId: number): Promise<PublicComment[]> {
  const rows = await all(d1, "SELECT id, parent_id, author_name, content, created_at, from_team FROM eg_comments WHERE ref_type = ?1 AND ref_id = ?2 AND status = 'approved' ORDER BY id ASC LIMIT 500", refType, refId)
  return rows.map((r) => ({ id: Number(r.id), parentId: r.parent_id == null ? null : Number(r.parent_id), name: String(r.author_name ?? ''), content: String(r.content ?? ''), createdAt: String(r.created_at ?? ''), fromTeam: Number(r.from_team ?? 0) === 1 }))
}

export async function hasApprovedBefore(d1: D1, email: string): Promise<boolean> {
  if (!email) return false
  return (await all(d1, "SELECT id FROM eg_comments WHERE author_email = ?1 AND status = 'approved' LIMIT 1", email)).length > 0
}

export async function isDuplicate(d1: D1, refType: string, refId: number, email: string, content: string): Promise<boolean> {
  return (await all(d1, 'SELECT id FROM eg_comments WHERE ref_type = ?1 AND ref_id = ?2 AND author_email = ?3 AND content = ?4 LIMIT 1', refType, refId, email, content)).length > 0
}

export async function parentBelongs(d1: D1, parentId: number, refType: string, refId: number): Promise<boolean> {
  return (await all(d1, "SELECT id FROM eg_comments WHERE id = ?1 AND ref_type = ?2 AND ref_id = ?3 AND status = 'approved'", parentId, refType, refId)).length > 0
}

export type NewRow = { refType: string; refId: number; parentId: number | null; name: string; email: string; userId: number | null; content: string; status: CommentStatus; fromTeam: boolean; ipHash: string }

export async function insertComment(d1: D1, v: NewRow, nowIso: string): Promise<number> {
  const res = await d1
    .prepare('INSERT INTO eg_comments (ref_type, ref_id, parent_id, author_name, author_email, user_id, content, status, from_team, ip_hash, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)')
    .bind(v.refType, v.refId, v.parentId, v.name, v.email, v.userId, v.content, v.status, v.fromTeam ? 1 : 0, v.ipHash, nowIso)
    .run()
  return Number(res.meta?.last_row_id ?? 0)
}

export type AdminComment = { id: number; refType: string; refId: number; parentId: number | null; name: string; email: string; content: string; status: CommentStatus; fromTeam: boolean; createdAt: string; postTitle: string }

export async function listForAdmin(d1: D1, status: CommentStatus | 'all', limit = 100): Promise<{ comments: AdminComment[]; counts: Record<CommentStatus, number> }> {
  const rows = status === 'all'
    ? await all(d1, "SELECT c.*, (SELECT title FROM eg_posts p WHERE p.id = c.ref_id) AS post_title FROM eg_comments c WHERE c.status != 'trash' ORDER BY c.id DESC LIMIT ?1", limit)
    : await all(d1, 'SELECT c.*, (SELECT title FROM eg_posts p WHERE p.id = c.ref_id) AS post_title FROM eg_comments c WHERE c.status = ?1 ORDER BY c.id DESC LIMIT ?2', status, limit)
  const counts: Record<CommentStatus, number> = { pending: 0, approved: 0, spam: 0, trash: 0 }
  for (const r of await all(d1, 'SELECT status, COUNT(*) AS n FROM eg_comments GROUP BY status')) counts[toStatus(r.status)] += Number(r.n ?? 0)
  return {
    counts,
    comments: rows.map((r) => ({ id: Number(r.id), refType: String(r.ref_type), refId: Number(r.ref_id), parentId: r.parent_id == null ? null : Number(r.parent_id), name: String(r.author_name ?? ''), email: String(r.author_email ?? ''), content: String(r.content ?? ''), status: toStatus(r.status), fromTeam: Number(r.from_team ?? 0) === 1, createdAt: String(r.created_at ?? ''), postTitle: String(r.post_title ?? '') })),
  }
}

export async function setStatus(d1: D1, ids: number[], status: CommentStatus, nowIso: string): Promise<void> {
  for (const id of ids.slice(0, 200)) await d1.prepare('UPDATE eg_comments SET status = ?1, updated_at = ?2 WHERE id = ?3').bind(status, nowIso, id).run()
}

export async function deleteComments(d1: D1, ids: number[]): Promise<void> {
  for (const id of ids.slice(0, 200)) {
    await d1.prepare('UPDATE eg_comments SET parent_id = NULL WHERE parent_id = ?1').bind(id).run()
    await d1.prepare('DELETE FROM eg_comments WHERE id = ?1').bind(id).run()
  }
}

export async function postPublishedDate(d1: D1, postId: number): Promise<{ exists: boolean; publishedAt: string | null }> {
  const r = (await all(d1, "SELECT published_date, created_at FROM eg_posts WHERE id = ?1 AND _status = 'published'", postId))[0]
  return r ? { exists: true, publishedAt: r.published_date ? String(r.published_date) : r.created_at ? String(r.created_at) : null } : { exists: false, publishedAt: null }
}
