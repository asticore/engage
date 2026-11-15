/**
 * Taskboard rules. Pure: no I/O, so every rule here is tested without a database.
 * Boards hold columns, columns hold cards. A card's `position` orders it inside its column.
 */

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export const DEFAULT_COLUMNS = ['To do', 'In progress', 'Review', 'Done'] as const

export type Card = {
  id: number
  boardId: number
  columnId: number
  title: string
  description: string
  assigneeId: number | null
  dueDate: string | null
  labels: string[]
  priority: Priority
  position: number
}

export type Board = { id: number; name: string; memberIds: number[] }

export type Person = { id: number; email: string; name: string }

export const isPriority = (value: unknown): value is Priority => typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)

const clean = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

export type CardInput = {
  title: string
  description: string
  assigneeId: number | null
  dueDate: string | null
  labels: string[]
  priority: Priority
}

/** Reads the card fields a person may send. Anything unexpected is dropped. */
export function parseCardInput(raw: unknown): { ok: true; card: CardInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Send the card details.' }
  const r = raw as Record<string, unknown>
  const title = clean(r.title, 200)
  if (!title) return { ok: false, error: 'Give the task a title.' }
  const assignee = r.assigneeId === null || r.assigneeId === undefined || r.assigneeId === '' ? null : Number(r.assigneeId)
  if (assignee !== null && (!Number.isInteger(assignee) || assignee < 1)) return { ok: false, error: 'Pick a person from the list.' }
  const due = typeof r.dueDate === 'string' && r.dueDate ? r.dueDate : null
  if (due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: 'The due date must be a date.' }
  const labels = Array.isArray(r.labels) ? r.labels.map((l) => clean(l, 30)).filter(Boolean).slice(0, 10) : typeof r.labels === 'string' ? r.labels.split(',').map((l) => clean(l, 30)).filter(Boolean).slice(0, 10) : []
  const priority = r.priority === undefined || r.priority === '' ? 'normal' : r.priority
  if (!isPriority(priority)) return { ok: false, error: 'Pick a priority from the list.' }
  return { ok: true, card: { title, description: clean(r.description, 5000), assigneeId: assignee, dueDate: due, labels: [...new Set(labels)], priority } }
}

/** A board with no members listed is open to every admin and staff user. */
export function canAccessBoard(board: Pick<Board, 'memberIds'>, user: { id: number; isAdmin: boolean }): boolean {
  if (user.isAdmin) return true
  return board.memberIds.length === 0 || board.memberIds.includes(user.id)
}

/** The people who may be given a card on a board: its members, or everyone when the board is open. */
export function assignablePeople(board: Pick<Board, 'memberIds'>, people: Person[]): Person[] {
  return board.memberIds.length === 0 ? people : people.filter((p) => board.memberIds.includes(p.id))
}

/**
 * Where cards end up after one card is dropped into `toColumn` at `toIndex`.
 * Returns each card's new column and position for every card in the two columns the move touches, so the caller
 * saves one consistent order. An unknown card or column changes nothing.
 */
export function moveCard(cards: Card[], cardId: number, toColumn: number, toIndex: number): { id: number; columnId: number; position: number }[] {
  const moving = cards.find((c) => c.id === cardId)
  if (!moving) return []
  const byPosition = (a: Card, b: Card): number => a.position - b.position || a.id - b.id
  const target = cards.filter((c) => c.columnId === toColumn && c.id !== cardId).sort(byPosition)
  const index = Math.max(0, Math.min(Number.isFinite(toIndex) ? Math.floor(toIndex) : target.length, target.length))
  target.splice(index, 0, { ...moving, columnId: toColumn })
  const updates = target.map((c, position) => ({ id: c.id, columnId: toColumn, position }))
  if (moving.columnId !== toColumn) {
    const source = cards.filter((c) => c.columnId === moving.columnId && c.id !== cardId).sort(byPosition)
    source.forEach((c, position) => updates.push({ id: c.id, columnId: c.columnId, position }))
  }
  return updates
}

/** The cards to show for the "My tasks" filter. */
export const myTasks = (cards: Card[], userId: number): Card[] => cards.filter((c) => c.assigneeId === userId)

export const isOverdue = (card: Pick<Card, 'dueDate'>, todayIso: string): boolean => Boolean(card.dueDate) && (card.dueDate as string) < todayIso

export type ColumnInput = { id?: number; name: string }

/** Reads an edited column list. At least one column, names trimmed and unique. */
export function parseColumns(raw: unknown): { ok: true; columns: ColumnInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'A board needs at least one column.' }
  if (raw.length > 12) return { ok: false, error: 'A board can have up to 12 columns.' }
  const out: ColumnInput[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>
    const name = clean(r.name, 60)
    if (!name) return { ok: false, error: 'Every column needs a name.' }
    if (seen.has(name.toLowerCase())) return { ok: false, error: 'Column names must be different.' }
    seen.add(name.toLowerCase())
    const id = Number(r.id)
    out.push(Number.isInteger(id) && id > 0 ? { id, name } : { name })
  }
  return { ok: true, columns: out }
}

export const parseBoardName = (raw: unknown): string => clean(raw, 100)

export function parseMemberIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
}

export const parseComment = (raw: unknown): string => clean(raw, 2000)

/** The wording of the assignment email. Plain text; the caller turns it into HTML. */
export function assignmentEmail(args: { siteName: string; boardName: string; card: Pick<Card, 'title' | 'dueDate' | 'priority'>; assignedBy: string }): { subject: string; text: string } {
  const site = args.siteName || 'the site'
  const lines = [`${args.assignedBy || 'Someone'} gave you a task on ${args.boardName}.`, '', `Task: ${args.card.title}`, `Priority: ${args.card.priority}`]
  if (args.card.dueDate) lines.push(`Due: ${args.card.dueDate}`)
  lines.push('', `Open the taskboard in the ${site} admin to see it.`)
  return { subject: `New task: ${args.card.title}`.replace(/[\r\n]+/g, ' '), text: lines.join('\n') }
}
