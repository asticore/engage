import { cleanSettings, DEFAULT_CHATBOT_SETTINGS, type ChatbotSettings } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = async (d1: D1, sql: string, ...args: unknown[]): Promise<number> => Number((await d1.prepare(sql).bind(...args).run()).meta?.changes ?? 0)

export async function getSettings(d1: D1): Promise<ChatbotSettings> {
  try {
    const r = (await all(d1, 'SELECT data FROM eg_chatbot_settings WHERE id = 1'))[0]
    if (!r) return DEFAULT_CHATBOT_SETTINGS
    return cleanSettings(JSON.parse(String(r.data ?? '{}')) as Record<string, unknown>)
  } catch {
    return DEFAULT_CHATBOT_SETTINGS
  }
}

export async function saveSettings(d1: D1, s: ChatbotSettings, nowIso: string): Promise<void> {
  await d1.prepare('INSERT INTO eg_chatbot_settings (id, data, updated_at) VALUES (1,?1,?2) ON CONFLICT(id) DO UPDATE SET data=?1, updated_at=?2').bind(JSON.stringify(s), nowIso).run()
}

/* -------------------------------------------------------- conversations */

export type Via = 'faq' | 'content' | 'ai' | 'order' | 'recommend' | 'handoff' | 'blocked' | 'capped'

/** Finds the visitor's conversation by its token, or starts one. The token is random and lives only in the visitor's browser. */
export async function openConversation(d1: D1, token: string, userId: number | null, nowIso: string): Promise<{ id: number; token: string }> {
  if (token) {
    const r = (await all(d1, 'SELECT id FROM eg_chatbot_conversations WHERE token = ?1', token))[0]
    if (r) {
      await run(d1, 'UPDATE eg_chatbot_conversations SET updated_at = ?1 WHERE id = ?2', nowIso, Number(r.id))
      return { id: Number(r.id), token }
    }
  }
  const fresh = crypto.randomUUID()
  const res = await d1.prepare('INSERT INTO eg_chatbot_conversations (token, user_id, handed_off, created_at, updated_at) VALUES (?1,?2,0,?3,?3)').bind(fresh, userId, nowIso).run()
  return { id: Number(res.meta?.last_row_id ?? 0), token: fresh }
}

export type NewMessage = { conversationId: number; role: 'user' | 'assistant'; content: string; via?: Via; sources?: Array<{ title: string; url: string }>; costMicro?: number }

export async function addMessage(d1: D1, m: NewMessage, nowIso: string): Promise<number> {
  const res = await d1
    .prepare('INSERT INTO eg_chatbot_messages (conversation_id, role, content, via, sources, cost_micro, rating, created_at) VALUES (?1,?2,?3,?4,?5,?6,0,?7)')
    .bind(m.conversationId, m.role, m.content, m.via ?? '', JSON.stringify(m.sources ?? []), m.costMicro ?? 0, nowIso)
    .run()
  if (m.via === 'handoff') await run(d1, 'UPDATE eg_chatbot_conversations SET handed_off = 1 WHERE id = ?1', m.conversationId)
  return Number(res.meta?.last_row_id ?? 0)
}

/** Sets a rating (1 helpful, -1 not helpful) on an assistant message that belongs to the visitor's own conversation. */
export async function rateMessage(d1: D1, token: string, messageId: number, rating: 1 | -1): Promise<boolean> {
  if (!token) return false
  const changes = await run(d1, "UPDATE eg_chatbot_messages SET rating = ?1 WHERE id = ?2 AND role = 'assistant' AND conversation_id IN (SELECT id FROM eg_chatbot_conversations WHERE token = ?3)", rating, messageId, token)
  return changes > 0
}

export type AdminMessage = { id: number; role: 'user' | 'assistant'; content: string; via: string; sources: Array<{ title: string; url: string }>; rating: number; createdAt: string }
export type AdminConversation = { id: number; userId: number | null; handedOff: boolean; createdAt: string; updatedAt: string; messages: AdminMessage[]; helpful: number; unhelpful: number }

const parseSources = (v: unknown): Array<{ title: string; url: string }> => {
  try {
    const x = JSON.parse(String(v ?? '[]')) as unknown
    return Array.isArray(x) ? x.filter((s): s is { title: string; url: string } => Boolean(s) && typeof (s as { url?: unknown }).url === 'string').map((s) => ({ title: String(s.title ?? ''), url: s.url })) : []
  } catch {
    return []
  }
}

export async function listConversations(d1: D1, filter: 'all' | 'handoff' | 'unhelpful', limit = 50): Promise<AdminConversation[]> {
  const where =
    filter === 'handoff'
      ? 'WHERE c.handed_off = 1'
      : filter === 'unhelpful'
        ? 'WHERE EXISTS (SELECT 1 FROM eg_chatbot_messages m WHERE m.conversation_id = c.id AND m.rating = -1)'
        : ''
  const convs = await all(d1, `SELECT c.id, c.user_id, c.handed_off, c.created_at, c.updated_at FROM eg_chatbot_conversations c ${where} ORDER BY c.updated_at DESC LIMIT ?1`, limit)
  const out: AdminConversation[] = []
  for (const c of convs) {
    const msgs = (await all(d1, 'SELECT id, role, content, via, sources, rating, created_at FROM eg_chatbot_messages WHERE conversation_id = ?1 ORDER BY id ASC LIMIT 200', Number(c.id))).map(
      (m): AdminMessage => ({ id: Number(m.id), role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content ?? ''), via: String(m.via ?? ''), sources: parseSources(m.sources), rating: Number(m.rating ?? 0), createdAt: String(m.created_at ?? '') }),
    )
    out.push({ id: Number(c.id), userId: c.user_id == null ? null : Number(c.user_id), handedOff: Number(c.handed_off ?? 0) === 1, createdAt: String(c.created_at ?? ''), updatedAt: String(c.updated_at ?? ''), messages: msgs, helpful: msgs.filter((m) => m.rating === 1).length, unhelpful: msgs.filter((m) => m.rating === -1).length })
  }
  return out
}

/** The visitor's question that came just before an assistant message, for the "teach it" screen. */
export async function questionBefore(d1: D1, messageId: number): Promise<string> {
  const r = (await all(d1, "SELECT content FROM eg_chatbot_messages WHERE role = 'user' AND conversation_id = (SELECT conversation_id FROM eg_chatbot_messages WHERE id = ?1) AND id < ?1 ORDER BY id DESC LIMIT 1", messageId))[0]
  return r ? String(r.content ?? '') : ''
}

export async function deleteConversation(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_chatbot_messages WHERE conversation_id = ?1', id)
  await run(d1, 'DELETE FROM eg_chatbot_conversations WHERE id = ?1', id)
}

/** Deletes conversations last touched before the cut-off. Returns how many. */
export async function purgeOlderThan(d1: D1, cutoffIso: string): Promise<number> {
  await run(d1, 'DELETE FROM eg_chatbot_messages WHERE conversation_id IN (SELECT id FROM eg_chatbot_conversations WHERE updated_at < ?1)', cutoffIso)
  return run(d1, 'DELETE FROM eg_chatbot_conversations WHERE updated_at < ?1', cutoffIso)
}

/** Removes every conversation of a signed-in customer. Used by the privacy erase. */
export async function eraseForUser(d1: D1, userId: number): Promise<number> {
  await run(d1, 'DELETE FROM eg_chatbot_messages WHERE conversation_id IN (SELECT id FROM eg_chatbot_conversations WHERE user_id = ?1)', userId)
  return run(d1, 'DELETE FROM eg_chatbot_conversations WHERE user_id = ?1', userId)
}

export type ChatStats = { conversations: number; questions: number; handoffs: number; helpful: number; unhelpful: number; costMicroMonth: number; callsMonth: number }

export async function stats(d1: D1, monthStartIso: string): Promise<ChatStats> {
  const one = async (sql: string, ...a: unknown[]): Promise<number> => Number((await all(d1, sql, ...a))[0]?.n ?? 0)
  let costMicroMonth = 0
  let callsMonth = 0
  try {
    const r = (await all(d1, "SELECT COALESCE(SUM(est_cost_micro),0) AS micro, COUNT(*) AS n FROM ai_builder_usage WHERE mode = 'chatbot' AND created_at >= ?1", monthStartIso))[0]
    costMicroMonth = Number(r?.micro ?? 0)
    callsMonth = Number(r?.n ?? 0)
  } catch {
    // The usage table appears with the first AI call.
  }
  return {
    conversations: await one('SELECT COUNT(*) AS n FROM eg_chatbot_conversations'),
    questions: await one("SELECT COUNT(*) AS n FROM eg_chatbot_messages WHERE role = 'user'"),
    handoffs: await one('SELECT COUNT(*) AS n FROM eg_chatbot_conversations WHERE handed_off = 1'),
    helpful: await one('SELECT COUNT(*) AS n FROM eg_chatbot_messages WHERE rating = 1'),
    unhelpful: await one('SELECT COUNT(*) AS n FROM eg_chatbot_messages WHERE rating = -1'),
    costMicroMonth,
    callsMonth,
  }
}
