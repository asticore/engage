import { cleanSettings, DEFAULT_LIVECHAT_SETTINGS, type ChatStatus, type Canned, type LiveChatSettings, type Sender } from './core'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = async (d1: D1, sql: string, ...args: unknown[]): Promise<{ id: number; changes: number }> => {
  const r = await d1.prepare(sql).bind(...args).run()
  return { id: Number(r.meta?.last_row_id ?? 0), changes: Number(r.meta?.changes ?? 0) }
}
const toStatus = (v: unknown): ChatStatus => (v === 'closed' || v === 'offline' ? v : 'open')

export async function getSettings(d1: D1): Promise<LiveChatSettings> {
  try {
    const r = (await all(d1, 'SELECT data FROM eg_livechat_settings WHERE id = 1'))[0]
    return r ? cleanSettings(JSON.parse(String(r.data ?? '{}')) as Record<string, unknown>) : DEFAULT_LIVECHAT_SETTINGS
  } catch {
    return DEFAULT_LIVECHAT_SETTINGS
  }
}

export async function saveSettings(d1: D1, s: LiveChatSettings, nowIso: string): Promise<void> {
  await run(d1, 'INSERT INTO eg_livechat_settings (id, data, updated_at) VALUES (1,?1,?2) ON CONFLICT(id) DO UPDATE SET data=?1, updated_at=?2', JSON.stringify(s), nowIso)
}

/* ---------------------------------------------------------------- staff */

export async function heartbeat(d1: D1, userId: number, name: string, nowIso: string): Promise<void> {
  await run(d1, 'INSERT INTO eg_livechat_staff (user_id, name, seen_at) VALUES (?1,?2,?3) ON CONFLICT(user_id) DO UPDATE SET name=?2, seen_at=?3', userId, name, nowIso)
}

export async function staffOnline(d1: D1, cutoffIso: string): Promise<number> {
  try {
    return Number((await all(d1, 'SELECT COUNT(*) AS n FROM eg_livechat_staff WHERE seen_at >= ?1', cutoffIso))[0]?.n ?? 0)
  } catch {
    return 0
  }
}

/* ---------------------------------------------------------------- chats */

export type Chat = { id: number; token: string; userId: number | null; name: string; email: string; status: ChatStatus; assignedTo: number | null; createdAt: string; updatedAt: string }
const toChat = (r: Row): Chat => ({ id: Number(r.id), token: String(r.token), userId: r.user_id == null ? null : Number(r.user_id), name: String(r.name ?? ''), email: String(r.email ?? ''), status: toStatus(r.status), assignedTo: r.assigned_to == null ? null : Number(r.assigned_to), createdAt: String(r.created_at ?? ''), updatedAt: String(r.updated_at ?? '') })

export async function createChat(d1: D1, v: { token: string; userId: number | null; name: string; email: string; status: ChatStatus }, nowIso: string): Promise<number> {
  return (await run(d1, 'INSERT INTO eg_livechat_chats (token, user_id, name, email, status, staff_seen_id, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,0,?6,?6)', v.token, v.userId, v.name, v.email, v.status, nowIso)).id
}

export async function chatByToken(d1: D1, token: string): Promise<Chat | null> {
  if (!token) return null
  const r = (await all(d1, 'SELECT * FROM eg_livechat_chats WHERE token = ?1', token))[0]
  return r ? toChat(r) : null
}

export async function getChat(d1: D1, id: number): Promise<Chat | null> {
  const r = (await all(d1, 'SELECT * FROM eg_livechat_chats WHERE id = ?1', id))[0]
  return r ? toChat(r) : null
}

export async function addMessage(d1: D1, v: { chatId: number; sender: Sender; staffId?: number | null; name: string; content: string; note?: boolean }, nowIso: string): Promise<number> {
  const id = (await run(d1, 'INSERT INTO eg_livechat_messages (chat_id, sender, staff_id, name, content, is_note, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)', v.chatId, v.sender, v.staffId ?? null, v.name, v.content, v.note ? 1 : 0, nowIso)).id
  if (!v.note) await run(d1, 'UPDATE eg_livechat_chats SET updated_at = ?1 WHERE id = ?2', nowIso, v.chatId)
  return id
}

export type Message = { id: number; sender: Sender; staffId: number | null; name: string; content: string; note: boolean; createdAt: string }
const toMessage = (r: Row): Message => ({ id: Number(r.id), sender: r.sender === 'staff' ? 'staff' : r.sender === 'system' ? 'system' : 'visitor', staffId: r.staff_id == null ? null : Number(r.staff_id), name: String(r.name ?? ''), content: String(r.content ?? ''), note: Number(r.is_note ?? 0) === 1, createdAt: String(r.created_at ?? '') })

/** Messages after an id. Visitors never get internal notes. */
export async function messagesAfter(d1: D1, chatId: number, afterId: number, includeNotes: boolean): Promise<Message[]> {
  const rows = await all(d1, `SELECT * FROM eg_livechat_messages WHERE chat_id = ?1 AND id > ?2 ${includeNotes ? '' : 'AND is_note = 0'} ORDER BY id ASC LIMIT 200`, chatId, afterId)
  return rows.map(toMessage)
}

export type InboxRow = Chat & { preview: string; unread: number; lastSender: Sender | '' }

export async function listInbox(d1: D1, filter: 'active' | 'mine' | 'unassigned' | 'offline' | 'closed', me: number, limit = 100): Promise<InboxRow[]> {
  const where: Record<string, string> = {
    active: "c.status != 'closed'",
    mine: `c.status != 'closed' AND c.assigned_to = ${Math.floor(me)}`,
    unassigned: "c.status != 'closed' AND c.assigned_to IS NULL",
    offline: "c.status = 'offline'",
    closed: "c.status = 'closed'",
  }
  const rows = await all(
    d1,
    `SELECT c.*, (SELECT content FROM eg_livechat_messages m WHERE m.chat_id = c.id AND m.is_note = 0 AND m.sender != 'system' ORDER BY m.id DESC LIMIT 1) AS preview,
      (SELECT sender FROM eg_livechat_messages m WHERE m.chat_id = c.id AND m.is_note = 0 AND m.sender != 'system' ORDER BY m.id DESC LIMIT 1) AS last_sender,
      (SELECT COUNT(*) FROM eg_livechat_messages m WHERE m.chat_id = c.id AND m.sender = 'visitor' AND m.id > c.staff_seen_id) AS unread
     FROM eg_livechat_chats c WHERE ${where[filter] ?? where.active} ORDER BY c.updated_at DESC LIMIT ?1`,
    limit,
  )
  return rows.map((r) => ({ ...toChat(r), preview: String(r.preview ?? '').slice(0, 120), unread: Number(r.unread ?? 0), lastSender: r.last_sender === 'staff' ? 'staff' : r.last_sender === 'visitor' ? 'visitor' : '' }))
}

export async function inboxCounts(d1: D1): Promise<{ active: number; unread: number; offline: number }> {
  const one = async (sql: string): Promise<number> => Number((await all(d1, sql))[0]?.n ?? 0)
  return {
    active: await one("SELECT COUNT(*) AS n FROM eg_livechat_chats WHERE status != 'closed'"),
    offline: await one("SELECT COUNT(*) AS n FROM eg_livechat_chats WHERE status = 'offline'"),
    unread: await one("SELECT COUNT(*) AS n FROM eg_livechat_chats c WHERE c.status != 'closed' AND EXISTS (SELECT 1 FROM eg_livechat_messages m WHERE m.chat_id = c.id AND m.sender = 'visitor' AND m.id > c.staff_seen_id)"),
  }
}

export async function markSeen(d1: D1, chatId: number): Promise<void> {
  await run(d1, 'UPDATE eg_livechat_chats SET staff_seen_id = COALESCE((SELECT MAX(id) FROM eg_livechat_messages WHERE chat_id = ?1), 0) WHERE id = ?1', chatId)
}

export async function setStatus(d1: D1, id: number, status: ChatStatus, nowIso: string): Promise<void> {
  await run(d1, 'UPDATE eg_livechat_chats SET status = ?1, updated_at = ?2 WHERE id = ?3', status, nowIso, id)
}

export async function assign(d1: D1, id: number, staffId: number | null, nowIso: string): Promise<void> {
  await run(d1, 'UPDATE eg_livechat_chats SET assigned_to = ?1, updated_at = ?2 WHERE id = ?3', staffId, nowIso, id)
}

export async function setVisitor(d1: D1, id: number, name: string, email: string): Promise<void> {
  await run(d1, 'UPDATE eg_livechat_chats SET name = ?1, email = ?2 WHERE id = ?3', name, email, id)
}

/** Closes open chats with no message since the cut-off. Returns how many. */
export async function closeIdle(d1: D1, cutoffIso: string, nowIso: string): Promise<number> {
  return (await run(d1, "UPDATE eg_livechat_chats SET status = 'closed', updated_at = ?2 WHERE status = 'open' AND updated_at < ?1", cutoffIso, nowIso)).changes
}

export async function purgeClosedBefore(d1: D1, cutoffIso: string): Promise<number> {
  await run(d1, "DELETE FROM eg_livechat_messages WHERE chat_id IN (SELECT id FROM eg_livechat_chats WHERE status = 'closed' AND updated_at < ?1)", cutoffIso)
  return (await run(d1, "DELETE FROM eg_livechat_chats WHERE status = 'closed' AND updated_at < ?1", cutoffIso)).changes
}

export async function deleteChat(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_livechat_messages WHERE chat_id = ?1', id)
  await run(d1, 'DELETE FROM eg_livechat_chats WHERE id = ?1', id)
}

/** Everything a signed-in customer said, by account or by the email they gave. Used by the privacy erase. */
export async function eraseFor(d1: D1, userId: number, email: string): Promise<number> {
  const where = email ? '(user_id = ?1 OR lower(email) = ?2)' : 'user_id = ?1'
  const args = email ? [userId, email.toLowerCase()] : [userId]
  await run(d1, `DELETE FROM eg_livechat_messages WHERE chat_id IN (SELECT id FROM eg_livechat_chats WHERE ${where})`, ...args)
  return (await run(d1, `DELETE FROM eg_livechat_chats WHERE ${where}`, ...args)).changes
}

/* --------------------------------------------------------------- canned */

export type CannedRow = Canned & { id: number }

export async function listCanned(d1: D1): Promise<CannedRow[]> {
  return (await all(d1, 'SELECT id, title, body FROM eg_livechat_canned ORDER BY title LIMIT 100')).map((r) => ({ id: Number(r.id), title: String(r.title), body: String(r.body) }))
}

export async function countCanned(d1: D1): Promise<number> {
  return Number((await all(d1, 'SELECT COUNT(*) AS n FROM eg_livechat_canned'))[0]?.n ?? 0)
}

export async function saveCanned(d1: D1, id: number | null, c: Canned, nowIso: string): Promise<void> {
  if (id) await run(d1, 'UPDATE eg_livechat_canned SET title = ?1, body = ?2 WHERE id = ?3', c.title, c.body, id)
  else await run(d1, 'INSERT INTO eg_livechat_canned (title, body, created_at) VALUES (?1,?2,?3)', c.title, c.body, nowIso)
}

export async function deleteCanned(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_livechat_canned WHERE id = ?1', id)
}

/** The last messages of the visitor's chatbot conversation (Task 30a), read from the database by its token so a visitor cannot invent a transcript. */
export async function botContext(d1: D1, botToken: string, limit = 10): Promise<string> {
  try {
    const rows = await all(
      d1,
      'SELECT role, content FROM (SELECT m.id, m.role, m.content FROM eg_chatbot_messages m WHERE m.conversation_id = (SELECT id FROM eg_chatbot_conversations WHERE token = ?1) ORDER BY m.id DESC LIMIT ?2) ORDER BY id ASC',
      botToken,
      limit,
    )
    return rows.map((r) => `${r.role === 'user' ? 'Visitor' : 'Bot'}: ${String(r.content ?? '').slice(0, 300)}`).join('\n')
  } catch {
    return ''
  }
}
