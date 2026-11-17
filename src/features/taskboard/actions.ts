import { assignablePeople, assignmentEmail, canAccessBoard, moveCard, parseBoardName, parseCardInput, parseColumns, parseComment, parseMemberIds, type Board } from './logic'
import type { OrgAccess } from '@/features/organizations/access'
import * as store from './store'

export type Actor = { id: number; isAdmin: boolean; label: string; orgAccess?: OrgAccess }
export type Deps = {
  d1: store.D1
  nowIso: string
  siteName: () => Promise<string>
  sendEmail: (args: { to: string; subject: string; html: string; text: string; template: string }) => Promise<unknown>
  textToHtml: (text: string) => string
  /** Raises a site event (webhooks and notification rules). Optional so tests can leave it out. */
  emit?: (event: 'task.assigned' | 'task.commented', data: Record<string, unknown>) => Promise<void>
  /** True when a notification rule is switched on for the event: then the rule sends the email, not the built-in one. */
  hasRule?: (event: 'task.assigned' | 'task.commented') => Promise<boolean>
}
export type Result = { status: number; body: Record<string, unknown> }

const fail = (status: number, error: string): Result => ({ status, body: { error } })
const ok = (extra: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...extra } })

/** Gives a card's new assignee an email, once, and records it. Best effort: a failed email never fails the save. */
async function notifyAssignee(deps: Deps, actor: Actor, board: Board, card: { id: number; title: string; dueDate: string | null; priority: 'low' | 'normal' | 'high' | 'urgent' }, assigneeId: number | null): Promise<void> {
  await store.logActivity(deps.d1, { boardId: board.id, cardId: card.id, userId: actor.id, action: 'card.assigned', detail: assigneeId ? `to user ${assigneeId}` : 'unassigned' }, deps.nowIso)
  if (!assigneeId || assigneeId === actor.id) return
  try {
    const person = (await store.listPeople(deps.d1)).find((p) => p.id === assigneeId)
    if (!person?.email) return
    if (deps.emit) await deps.emit('task.assigned', { id: card.id, boardId: board.id, title: card.title, assigneeId, dueDate: card.dueDate, priority: card.priority, createdAt: deps.nowIso, email: person.email, boardName: board.name, person: actor.label }).catch((): void => undefined)
    // A switched-on notification rule for "Task assigned" owns the email; without one the built-in plain email goes out.
    if (deps.hasRule && (await deps.hasRule('task.assigned').catch((): boolean => false))) return
    const mail = assignmentEmail({ siteName: await deps.siteName(), boardName: board.name, card, assignedBy: actor.label })
    await deps.sendEmail({ to: person.email, subject: mail.subject, text: mail.text, html: deps.textToHtml(mail.text), template: 'taskboard.assigned' })
  } catch {
    // Best effort.
  }
}

/** Every write the taskboard accepts. Checks board access first, then does the one thing asked. */
export async function runAction(deps: Deps, actor: Actor, body: Record<string, unknown>): Promise<Result> {
  const { d1, nowIso } = deps
  const action = String(body.action ?? '')

  if (action === 'create-board') {
    if (!actor.isAdmin) return fail(403, 'Only an admin can add a board.')
    const name = parseBoardName(body.name)
    if (!name) return fail(400, 'Give the board a name.')
    const scope = await store.validScope(d1, body.organizationId, body.teamId)
    if (!scope) return fail(400, 'Pick a team that belongs to the chosen company.')
    return ok({ id: await store.createBoard(d1, name, parseMemberIds(body.memberIds), actor.id, nowIso, scope) })
  }

  const boardId = Number(body.boardId)
  if (!Number.isInteger(boardId) || boardId < 1) return fail(400, 'Pick a board.')
  const board = await store.getBoard(d1, boardId)
  if (!board || !canAccessBoard(board, actor, actor.orgAccess)) return fail(404, 'That board is not available to you.')

  switch (action) {
    case 'update-board': {
      if (!actor.isAdmin) return fail(403, 'Only an admin can change a board.')
      const name = parseBoardName(body.name)
      if (!name) return fail(400, 'Give the board a name.')
      const columns = parseColumns(body.columns)
      if (columns.ok === false) return fail(400, columns.error)
      const scope = 'organizationId' in body || 'teamId' in body ? await store.validScope(d1, body.organizationId, body.teamId) : undefined
      if (scope === null) return fail(400, 'Pick a team that belongs to the chosen company.')
      await store.updateBoard(d1, boardId, name, parseMemberIds(body.memberIds), nowIso, scope)
      await store.saveColumns(d1, boardId, columns.columns)
      return ok()
    }
    case 'delete-board':
      if (!actor.isAdmin) return fail(403, 'Only an admin can delete a board.')
      await store.deleteBoard(d1, boardId)
      return ok()
    case 'save-card': {
      const parsed = parseCardInput(body.card)
      if (parsed.ok === false) return fail(400, parsed.error)
      const people = await store.listPeople(d1)
      if (parsed.card.assigneeId !== null && !assignablePeople(board, people).some((p) => p.id === parsed.card.assigneeId)) return fail(400, 'That person cannot be given a task on this board.')
      const cardId = Number(body.cardId)
      if (Number.isInteger(cardId) && cardId > 0) {
        const existing = await store.getCard(d1, cardId)
        if (!existing || existing.boardId !== boardId) return fail(404, 'That task is not on this board.')
        await store.updateCard(d1, cardId, parsed.card, nowIso)
        if (existing.assigneeId !== parsed.card.assigneeId) await notifyAssignee(deps, actor, board, { id: cardId, ...parsed.card }, parsed.card.assigneeId)
        return ok({ id: cardId })
      }
      const columns = (await store.boardData(d1, boardId)).columns
      const columnId = Number(body.columnId)
      const column = columns.find((c) => c.id === columnId) ?? columns[0]
      if (!column) return fail(400, 'The board has no columns.')
      const id = await store.createCard(d1, boardId, column.id, parsed.card, actor.id, nowIso)
      if (parsed.card.assigneeId) await notifyAssignee(deps, actor, board, { id, ...parsed.card }, parsed.card.assigneeId)
      return ok({ id })
    }
    case 'move-card': {
      const data = await store.boardData(d1, boardId)
      const cardId = Number(body.cardId)
      const toColumn = Number(body.columnId)
      const card = data.cards.find((c) => c.id === cardId)
      const column = data.columns.find((c) => c.id === toColumn)
      if (!card || !column) return fail(404, 'That task or column is not on this board.')
      await store.applyMoves(d1, moveCard(data.cards, cardId, toColumn, Number(body.index)), nowIso)
      if (card.columnId !== toColumn) {
        const from = data.columns.find((c) => c.id === card.columnId)?.name ?? ''
        await store.logActivity(d1, { boardId, cardId, userId: actor.id, action: 'card.moved', detail: `${card.title}: ${from} to ${column.name}` }, nowIso)
      }
      return ok()
    }
    case 'delete-card': {
      const card = await store.getCard(d1, Number(body.cardId))
      if (!card || card.boardId !== boardId) return fail(404, 'That task is not on this board.')
      await store.deleteCard(d1, card.id)
      await store.logActivity(d1, { boardId, userId: actor.id, action: 'card.deleted', detail: card.title }, nowIso)
      return ok()
    }
    case 'add-comment': {
      const card = await store.getCard(d1, Number(body.cardId))
      if (!card || card.boardId !== boardId) return fail(404, 'That task is not on this board.')
      const text = parseComment(body.body)
      if (!text) return fail(400, 'Write a comment first.')
      await store.addComment(d1, card.id, actor.id, text, nowIso)
      await store.logActivity(d1, { boardId, cardId: card.id, userId: actor.id, action: 'card.commented', detail: card.title }, nowIso)
      // Tell the person the task is given to (not when they wrote the comment themselves).
      if (deps.emit && card.assigneeId && card.assigneeId !== actor.id) {
        const person = await store.getPerson(d1, card.assigneeId).catch((): null => null)
        if (person?.email) await deps.emit('task.commented', { id: card.id, boardId, title: card.title, assigneeId: card.assigneeId, dueDate: card.dueDate, priority: card.priority, createdAt: nowIso, email: person.email, boardName: board.name, person: actor.label }).catch((): void => undefined)
      }
      return ok()
    }
    case 'archive-card':
    case 'restore-card': {
      const card = await store.getCard(d1, Number(body.cardId))
      if (!card || card.boardId !== boardId) return fail(404, 'That task is not on this board.')
      const archiving = action === 'archive-card'
      await store.setArchived(d1, card.id, archiving ? nowIso : null)
      await store.logActivity(d1, { boardId, cardId: card.id, userId: actor.id, action: archiving ? 'card.archived' : 'card.restored', detail: card.title }, nowIso)
      return ok()
    }
    default:
      return fail(400, 'Unknown action.')
  }
}
