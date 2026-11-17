import { DEFAULT_COLUMNS, isPriority, type Board, type Card, type CardInput, type ColumnInput, type Person } from './logic'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }

type Row = Record<string, unknown>
const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = (d1: D1, sql: string, ...args: unknown[]) => d1.prepare(sql).bind(...args).run()

const json = <T>(value: unknown, fallback: T): T => {
  try {
    const parsed = JSON.parse(String(value ?? ''))
    return Array.isArray(parsed) ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

const toBoard = (r: Row): Board => ({ id: Number(r.id), name: String(r.name ?? ''), memberIds: json<unknown[]>(r.member_ids, []).map(Number).filter((n) => Number.isInteger(n) && n > 0) })

const toCard = (r: Row): Card => ({
  id: Number(r.id),
  boardId: Number(r.board_id),
  columnId: Number(r.column_id),
  title: String(r.title ?? ''),
  description: String(r.description ?? ''),
  assigneeId: r.assignee_id === null || r.assignee_id === undefined ? null : Number(r.assignee_id),
  dueDate: r.due_date ? String(r.due_date) : null,
  labels: json<unknown[]>(r.labels, []).map(String),
  priority: isPriority(r.priority) ? r.priority : 'normal',
  position: Number(r.position ?? 0),
  archived: Boolean(r.archived_at),
})

export type Column = { id: number; boardId: number; name: string; position: number }
export type Activity = { id: number; cardId: number | null; userId: number | null; action: string; detail: string; createdAt: string }
export type Comment = { id: number; cardId: number; userId: number | null; body: string; createdAt: string }

/** Admin and staff users who may be given a card. */
export async function listPeople(d1: D1): Promise<Person[]> {
  const rows = await all(
    d1,
    "SELECT u.id AS id, u.email AS email, u.display_name AS name FROM eg_users u WHERE EXISTS (SELECT 1 FROM eg_users_roles r WHERE r.parent_id = u.id AND r.value IN ('admin','editor','viewer')) ORDER BY u.email",
  )
  return rows.map((r) => ({ id: Number(r.id), email: String(r.email ?? ''), name: String(r.name ?? '') }))
}

export async function listBoards(d1: D1): Promise<Board[]> {
  return (await all(d1, 'SELECT id, name, member_ids FROM eg_task_boards ORDER BY id')).map(toBoard)
}

export async function getBoard(d1: D1, id: number): Promise<Board | null> {
  const rows = await all(d1, 'SELECT id, name, member_ids FROM eg_task_boards WHERE id = ?1', id)
  return rows[0] ? toBoard(rows[0]) : null
}

export async function boardData(d1: D1, boardId: number): Promise<{ columns: Column[]; cards: Card[]; activity: Activity[] }> {
  const columns = (await all(d1, 'SELECT id, board_id, name, position FROM eg_task_columns WHERE board_id = ?1 ORDER BY position, id', boardId)).map((r) => ({ id: Number(r.id), boardId: Number(r.board_id), name: String(r.name ?? ''), position: Number(r.position ?? 0) }))
  const cards = (await all(d1, 'SELECT * FROM eg_task_cards WHERE board_id = ?1 ORDER BY position, id', boardId)).map(toCard)
  const activity = (await all(d1, 'SELECT id, card_id, user_id, action, detail, created_at FROM eg_task_activity WHERE board_id = ?1 ORDER BY id DESC LIMIT 50', boardId)).map((r) => ({
    id: Number(r.id),
    cardId: r.card_id === null ? null : Number(r.card_id),
    userId: r.user_id === null ? null : Number(r.user_id),
    action: String(r.action ?? ''),
    detail: String(r.detail ?? ''),
    createdAt: String(r.created_at ?? ''),
  }))
  return { columns, cards, activity }
}

export async function getCard(d1: D1, id: number): Promise<Card | null> {
  const rows = await all(d1, 'SELECT * FROM eg_task_cards WHERE id = ?1', id)
  return rows[0] ? toCard(rows[0]) : null
}

export async function logActivity(d1: D1, entry: { boardId: number; cardId?: number | null; userId: number | null; action: string; detail?: string }, nowIso: string): Promise<void> {
  await run(d1, 'INSERT INTO eg_task_activity (board_id, card_id, user_id, action, detail, created_at) VALUES (?1,?2,?3,?4,?5,?6)', entry.boardId, entry.cardId ?? null, entry.userId, entry.action, (entry.detail ?? '').slice(0, 300), nowIso)
}

export async function createBoard(d1: D1, name: string, memberIds: number[], userId: number, nowIso: string): Promise<number> {
  const result = await run(d1, 'INSERT INTO eg_task_boards (name, member_ids, created_by, updated_at, created_at) VALUES (?1,?2,?3,?4,?4)', name, JSON.stringify(memberIds), userId, nowIso)
  const id = Number(result.meta?.last_row_id)
  for (let i = 0; i < DEFAULT_COLUMNS.length; i += 1) await run(d1, 'INSERT INTO eg_task_columns (board_id, name, position) VALUES (?1,?2,?3)', id, DEFAULT_COLUMNS[i], i)
  await logActivity(d1, { boardId: id, userId, action: 'board.created', detail: name }, nowIso)
  return id
}

export async function updateBoard(d1: D1, id: number, name: string, memberIds: number[], nowIso: string): Promise<void> {
  await run(d1, 'UPDATE eg_task_boards SET name = ?1, member_ids = ?2, updated_at = ?3 WHERE id = ?4', name, JSON.stringify(memberIds), nowIso, id)
}

export async function deleteBoard(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_task_comments WHERE card_id IN (SELECT id FROM eg_task_cards WHERE board_id = ?1)', id)
  await run(d1, 'DELETE FROM eg_task_cards WHERE board_id = ?1', id)
  await run(d1, 'DELETE FROM eg_task_columns WHERE board_id = ?1', id)
  await run(d1, 'DELETE FROM eg_task_activity WHERE board_id = ?1', id)
  await run(d1, 'DELETE FROM eg_task_boards WHERE id = ?1', id)
}

/** Saves an edited column list: renames, adds, reorders, and moves the cards of a removed column into the first column. */
export async function saveColumns(d1: D1, boardId: number, columns: ColumnInput[]): Promise<void> {
  const existing = (await all(d1, 'SELECT id FROM eg_task_columns WHERE board_id = ?1', boardId)).map((r) => Number(r.id))
  const keep = new Set<number>()
  const ids: number[] = []
  for (let i = 0; i < columns.length; i += 1) {
    const c = columns[i]
    if (c.id && existing.includes(c.id)) {
      await run(d1, 'UPDATE eg_task_columns SET name = ?1, position = ?2 WHERE id = ?3', c.name, i, c.id)
      keep.add(c.id)
      ids.push(c.id)
    } else {
      const result = await run(d1, 'INSERT INTO eg_task_columns (board_id, name, position) VALUES (?1,?2,?3)', boardId, c.name, i)
      ids.push(Number(result.meta?.last_row_id))
    }
  }
  const first = ids[0]
  for (const id of existing) {
    if (keep.has(id)) continue
    await run(d1, 'UPDATE eg_task_cards SET column_id = ?1 WHERE column_id = ?2', first, id)
    await run(d1, 'DELETE FROM eg_task_columns WHERE id = ?1', id)
  }
}

export async function nextPosition(d1: D1, columnId: number): Promise<number> {
  const rows = await all(d1, 'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM eg_task_cards WHERE column_id = ?1', columnId)
  return Number(rows[0]?.next ?? 0)
}

export async function createCard(d1: D1, boardId: number, columnId: number, card: CardInput, userId: number, nowIso: string): Promise<number> {
  const position = await nextPosition(d1, columnId)
  const result = await run(
    d1,
    'INSERT INTO eg_task_cards (board_id, column_id, title, description, assignee_id, due_date, labels, priority, position, created_by, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)',
    boardId, columnId, card.title, card.description, card.assigneeId, card.dueDate, JSON.stringify(card.labels), card.priority, position, userId, nowIso,
  )
  const id = Number(result.meta?.last_row_id)
  await logActivity(d1, { boardId, cardId: id, userId, action: 'card.created', detail: card.title }, nowIso)
  return id
}

export async function updateCard(d1: D1, id: number, card: CardInput, nowIso: string): Promise<void> {
  await run(d1, 'UPDATE eg_task_cards SET title=?1, description=?2, assignee_id=?3, due_date=?4, labels=?5, priority=?6, updated_at=?7 WHERE id=?8', card.title, card.description, card.assigneeId, card.dueDate, JSON.stringify(card.labels), card.priority, nowIso, id)
}

export async function deleteCard(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_task_comments WHERE card_id = ?1', id)
  await run(d1, 'DELETE FROM eg_task_cards WHERE id = ?1', id)
}

export async function applyMoves(d1: D1, moves: { id: number; columnId: number; position: number }[], nowIso: string): Promise<void> {
  for (const m of moves) await run(d1, 'UPDATE eg_task_cards SET column_id = ?1, position = ?2, updated_at = ?3 WHERE id = ?4', m.columnId, m.position, nowIso, m.id)
}

export async function listComments(d1: D1, cardId: number): Promise<Comment[]> {
  return (await all(d1, 'SELECT id, card_id, user_id, body, created_at FROM eg_task_comments WHERE card_id = ?1 ORDER BY id', cardId)).map((r) => ({
    id: Number(r.id),
    cardId: Number(r.card_id),
    userId: r.user_id === null ? null : Number(r.user_id),
    body: String(r.body ?? ''),
    createdAt: String(r.created_at ?? ''),
  }))
}

export async function addComment(d1: D1, cardId: number, userId: number, body: string, nowIso: string): Promise<void> {
  await run(d1, 'INSERT INTO eg_task_comments (card_id, user_id, body, created_at) VALUES (?1,?2,?3,?4)', cardId, userId, body, nowIso)
}

/** Archives a card (hidden from the board) or, with null, restores it. */
export async function setArchived(d1: D1, id: number, archivedAt: string | null): Promise<void> {
  await run(d1, 'UPDATE eg_task_cards SET archived_at = ?1, updated_at = COALESCE(?1, updated_at) WHERE id = ?2', archivedAt, id)
}

/** Open cards given to one person, across the boards they may open. Archived cards are left out. */
export async function cardsForPerson(d1: D1, userId: number, boardIds: number[]): Promise<(Card & { boardName: string; columnName: string })[]> {
  if (boardIds.length === 0) return []
  const marks = boardIds.map((_, i) => `?${i + 2}`).join(',')
  const rows = await all(
    d1,
    `SELECT k.*, b.name AS board_name, c.name AS column_name FROM eg_task_cards k JOIN eg_task_boards b ON b.id = k.board_id LEFT JOIN eg_task_columns c ON c.id = k.column_id WHERE k.assignee_id = ?1 AND k.archived_at IS NULL AND k.board_id IN (${marks}) ORDER BY (k.due_date IS NULL), k.due_date, k.id`,
    userId,
    ...boardIds,
  )
  return rows.map((r) => ({ ...toCard(r), boardName: String(r.board_name ?? ''), columnName: String(r.column_name ?? '') }))
}

/** Cards to remind about: given to someone, not archived, not in the board's last (done) column, due on or before `untilIso`, and not reminded for this due date yet. */
export async function cardsDueForReminder(d1: D1, untilIso: string): Promise<(Card & { boardName: string })[]> {
  const rows = await all(
    d1,
    `SELECT k.*, b.name AS board_name FROM eg_task_cards k JOIN eg_task_boards b ON b.id = k.board_id WHERE k.assignee_id IS NOT NULL AND k.archived_at IS NULL AND k.due_date IS NOT NULL AND k.due_date <= ?1 AND (k.due_notified IS NULL OR k.due_notified <> k.due_date) AND k.column_id <> COALESCE((SELECT c2.id FROM eg_task_columns c2 WHERE c2.board_id = k.board_id ORDER BY c2.position DESC, c2.id DESC LIMIT 1), 0) ORDER BY k.due_date LIMIT 100`,
    untilIso,
  )
  return rows.map((r) => ({ ...toCard(r), boardName: String(r.board_name ?? '') }))
}

export async function markDueNotified(d1: D1, id: number, dueDate: string): Promise<void> {
  await run(d1, 'UPDATE eg_task_cards SET due_notified = ?1 WHERE id = ?2', dueDate, id)
}

export async function getPerson(d1: D1, id: number): Promise<Person | null> {
  return (await listPeople(d1)).find((p) => p.id === id) ?? null
}

/** The newest activity entry id (0 when there is none), so a caller can later read only what one request added. */
export async function latestActivityId(d1: D1): Promise<number> {
  return Number((await all(d1, 'SELECT COALESCE(MAX(id), 0) AS id FROM eg_task_activity'))[0]?.id ?? 0)
}

/** Activity entries added after `afterId`, oldest first, across every board. */
export async function activitySince(d1: D1, afterId: number): Promise<(Activity & { boardId: number })[]> {
  return (await all(d1, 'SELECT id, board_id, card_id, user_id, action, detail, created_at FROM eg_task_activity WHERE id > ?1 ORDER BY id LIMIT 50', afterId)).map((r) => ({
    id: Number(r.id),
    boardId: Number(r.board_id),
    cardId: r.card_id === null ? null : Number(r.card_id),
    userId: r.user_id === null ? null : Number(r.user_id),
    action: String(r.action ?? ''),
    detail: String(r.detail ?? ''),
    createdAt: String(r.created_at ?? ''),
  }))
}
