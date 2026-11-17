// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import { runAction, type Actor, type Deps } from '@/features/taskboard/actions'
import { assignablePeople, assignmentEmail, canAccessBoard, isOverdue, moveCard, myTasks, parseCardInput, parseColumns, type Card } from '@/features/taskboard/logic'
import * as store from '@/features/taskboard/store'
import { taskboardAuditEntry } from '@/features/taskboard/activityLog'
import { dueSoonCutoff, runTaskDueReminders } from '@/features/taskboard/dueReminders'
import { TASKBOARD_STATEMENTS } from '@/migrations/20270316_100000_taskboard'
import { FEATURES } from '@/features/registry'
import { ownerOfTable } from '@/features/featureTables'

const card = (id: number, columnId: number, position: number): Card => ({ id, boardId: 1, columnId, title: `c${id}`, description: '', assigneeId: null, dueDate: null, labels: [], priority: 'normal', position, archived: false })

describe('taskboard rules', () => {
  it('moves a card between and within columns with a consistent order', () => {
    const cards = [card(1, 10, 0), card(2, 10, 1), card(3, 11, 0)]
    const across = moveCard(cards, 1, 11, 0)
    expect(across.filter((m) => m.columnId === 11).sort((a, b) => a.position - b.position).map((m) => m.id)).toEqual([1, 3])
    expect(across.find((m) => m.id === 2)).toMatchObject({ columnId: 10, position: 0 })
    const within = moveCard(cards, 1, 10, 5)
    expect(within.sort((a, b) => a.position - b.position).map((m) => m.id)).toEqual([2, 1])
    expect(moveCard(cards, 99, 10, 0)).toEqual([])
  })
  it('checks a card before saving it', () => {
    expect(parseCardInput({ title: ' ' }).ok).toBe(false)
    expect(parseCardInput({ title: 'a', dueDate: 'tomorrow' }).ok).toBe(false)
    expect(parseCardInput({ title: 'a', priority: 'whenever' }).ok).toBe(false)
    expect(parseCardInput({ title: 'a', assigneeId: 'x' }).ok).toBe(false)
    expect(parseCardInput({ title: 'a', labels: 'x, y, x', assigneeId: '3' })).toMatchObject({ ok: true, card: { labels: ['x', 'y'], assigneeId: 3 } })
  })
  it('limits boards to their members, admins always get in', () => {
    const board = { memberIds: [2] }
    expect(canAccessBoard(board, { id: 2, isAdmin: false })).toBe(true)
    expect(canAccessBoard(board, { id: 3, isAdmin: false })).toBe(false)
    expect(canAccessBoard(board, { id: 3, isAdmin: true })).toBe(true)
    expect(canAccessBoard({ memberIds: [] }, { id: 3, isAdmin: false })).toBe(true)
    expect(assignablePeople(board, [{ id: 2, email: 'a', name: '' }, { id: 3, email: 'b', name: '' }]).map((p) => p.id)).toEqual([2])
  })
  it('filters my tasks, flags overdue and validates columns', () => {
    expect(myTasks([{ ...card(1, 1, 0), assigneeId: 5 }, card(2, 1, 1)], 5).map((c) => c.id)).toEqual([1])
    expect(isOverdue({ dueDate: '2027-01-01' }, '2027-02-01')).toBe(true)
    expect(isOverdue({ dueDate: null }, '2027-02-01')).toBe(false)
    expect(parseColumns([]).ok).toBe(false)
    expect(parseColumns([{ name: 'A' }, { name: 'a' }]).ok).toBe(false)
    expect(parseColumns([{ name: 'A' }, { id: 4, name: 'B' }])).toMatchObject({ ok: true })
  })
  it('keeps line breaks out of the email subject', () => {
    expect(assignmentEmail({ siteName: 'S', boardName: 'B', card: { title: 'a\nb', dueDate: null, priority: 'high' }, assignedBy: 'Sam' }).subject).toBe('New task: a b')
  })
  it('is a lazy section that owns its tables', () => {
    expect(FEATURES.find((f) => f.key === 'taskboard')?.defaultEnabled).toBe(false)
    for (const t of ['eg_task_boards', 'eg_task_columns', 'eg_task_cards', 'eg_task_comments', 'eg_task_activity']) expect(ownerOfTable(t)).toBe('taskboard')
  })
})

function setup() {
  const raw = new DatabaseSync(':memory:')
  raw.exec('CREATE TABLE eg_users (id integer primary key, email text, display_name text); CREATE TABLE eg_users_roles (id integer primary key, parent_id integer, value text);')
  raw.exec("INSERT INTO eg_users VALUES (1,'admin@x.test','Ada'),(2,'ed@x.test','Ed'),(3,'cust@x.test',NULL); INSERT INTO eg_users_roles VALUES (1,1,'admin'),(2,2,'editor'),(3,3,'customer');")
  for (const statement of TASKBOARD_STATEMENTS) raw.exec(statement)
  const d1: store.D1 = {
    prepare: (query) => ({
      bind: (...args) => ({
        all: async <T,>() => ({ results: raw.prepare(query).all(...(args as never[])) as T[] }),
        run: async () => {
          const r = raw.prepare(query).run(...(args as never[]))
          return { meta: { last_row_id: Number(r.lastInsertRowid) } }
        },
      }),
    }),
  }
  const sent: { to: string; subject: string }[] = []
  const deps: Deps = { d1, nowIso: '2027-03-16T10:00:00.000Z', siteName: async () => 'Site', textToHtml: (t) => t, sendEmail: async (a) => { sent.push({ to: a.to, subject: a.subject }) } }
  return { raw, d1, deps, sent }
}
const admin: Actor = { id: 1, isAdmin: true, label: 'Ada' }
const editor: Actor = { id: 2, isAdmin: false, label: 'Ed' }

describe('taskboard actions', () => {
  it('lists only admin and staff as people', async () => {
    const { d1 } = setup()
    expect((await store.listPeople(d1)).map((p) => p.id)).toEqual([1, 2])
  })
  it('a new board has the four default columns and only an admin can add one', async () => {
    const { d1, deps } = setup()
    expect((await runAction(deps, editor, { action: 'create-board', name: 'X' })).status).toBe(403)
    const made = await runAction(deps, admin, { action: 'create-board', name: 'Launch' })
    const id = Number(made.body.id)
    expect((await store.boardData(d1, id)).columns.map((c) => c.name)).toEqual(['To do', 'In progress', 'Review', 'Done'])
  })
  it('creates, assigns with an email, moves with an activity entry and comments', async () => {
    const { d1, deps, sent } = setup()
    const id = Number((await runAction(deps, admin, { action: 'create-board', name: 'Launch' })).body.id)
    const [todo, doing] = (await store.boardData(d1, id)).columns
    const made = await runAction(deps, admin, { action: 'save-card', boardId: id, columnId: todo.id, card: { title: 'Write copy', assigneeId: 2, priority: 'high' } })
    expect(made.status).toBe(200)
    expect(sent).toEqual([{ to: 'ed@x.test', subject: 'New task: Write copy' }])
    const cardId = Number(made.body.id)
    expect((await runAction(deps, editor, { action: 'move-card', boardId: id, cardId, columnId: doing.id, index: 0 })).status).toBe(200)
    expect((await store.getCard(d1, cardId))?.columnId).toBe(doing.id)
    expect((await runAction(deps, editor, { action: 'add-comment', boardId: id, cardId, body: 'On it' })).status).toBe(200)
    expect((await store.listComments(d1, cardId)).map((c) => c.body)).toEqual(['On it'])
    const actions = (await store.boardData(d1, id)).activity.map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['card.assigned', 'card.moved', 'card.commented']))
    // Giving it to yourself sends nothing.
    await runAction(deps, editor, { action: 'save-card', boardId: id, cardId, card: { title: 'Write copy', assigneeId: 2, priority: 'high' } })
    expect(sent).toHaveLength(1)
  })
  it('refuses a customer as assignee and a board the person is not on', async () => {
    const { d1, deps } = setup()
    const id = Number((await runAction(deps, admin, { action: 'create-board', name: 'Private', memberIds: [1] })).body.id)
    const col = (await store.boardData(d1, id)).columns[0]
    expect((await runAction(deps, admin, { action: 'save-card', boardId: id, columnId: col.id, card: { title: 'x', assigneeId: 3 } })).status).toBe(400)
    expect((await runAction(deps, editor, { action: 'save-card', boardId: id, columnId: col.id, card: { title: 'x' } })).status).toBe(404)
  })
  it('removing a column moves its cards to the first column', async () => {
    const { d1, deps } = setup()
    const id = Number((await runAction(deps, admin, { action: 'create-board', name: 'B' })).body.id)
    const cols = (await store.boardData(d1, id)).columns
    const made = await runAction(deps, admin, { action: 'save-card', boardId: id, columnId: cols[3].id, card: { title: 'Done thing' } })
    const res = await runAction(deps, admin, { action: 'update-board', boardId: id, name: 'B', memberIds: [], columns: [{ id: cols[0].id, name: 'Backlog' }, { id: cols[1].id, name: 'Doing' }] })
    expect(res.status).toBe(200)
    const after = await store.boardData(d1, id)
    expect(after.columns.map((c) => c.name)).toEqual(['Backlog', 'Doing'])
    expect(after.cards.find((c) => c.id === Number(made.body.id))?.columnId).toBe(cols[0].id)
  })
})

describe('taskboard archive, my tasks, events and due reminders', () => {
  const boardWithCard = async (extra: Record<string, unknown> = {}) => {
    const ctx = setup()
    const id = Number((await runAction(ctx.deps, admin, { action: 'create-board', name: 'Launch' })).body.id)
    const cols = (await store.boardData(ctx.d1, id)).columns
    const made = await runAction(ctx.deps, admin, { action: 'save-card', boardId: id, columnId: cols[0].id, card: { title: 'Write copy', assigneeId: 2, ...extra } })
    return { ...ctx, id, cols, cardId: Number(made.body.id) }
  }
  it('archives and restores a card, and archived cards leave My tasks', async () => {
    const { d1, deps, id, cardId } = await boardWithCard()
    expect((await store.cardsForPerson(d1, 2, [id])).map((c) => c.id)).toEqual([cardId])
    expect((await runAction(deps, editor, { action: 'archive-card', boardId: id, cardId })).status).toBe(200)
    expect((await store.getCard(d1, cardId))?.archived).toBe(true)
    expect(await store.cardsForPerson(d1, 2, [id])).toEqual([])
    expect((await runAction(deps, editor, { action: 'restore-card', boardId: id, cardId })).status).toBe(200)
    expect((await store.getCard(d1, cardId))?.archived).toBe(false)
    expect((await store.boardData(d1, id)).activity.map((a) => a.action)).toEqual(expect.arrayContaining(['card.archived', 'card.restored']))
  })
  it('raises task.assigned and task.commented, and a switched on rule owns the email', async () => {
    const ctx = setup()
    const events: string[] = []
    let rule = false
    const deps: Deps = { ...ctx.deps, emit: async (event, data) => { events.push(`${event}:${String(data.email)}`) }, hasRule: async () => rule }
    const id = Number((await runAction(deps, admin, { action: 'create-board', name: 'B' })).body.id)
    const col = (await store.boardData(ctx.d1, id)).columns[0]
    const made = await runAction(deps, admin, { action: 'save-card', boardId: id, columnId: col.id, card: { title: 'T', assigneeId: 2 } })
    expect(events).toEqual(['task.assigned:ed@x.test'])
    expect(ctx.sent).toHaveLength(1)
    await runAction(deps, admin, { action: 'add-comment', boardId: id, cardId: Number(made.body.id), body: 'hi' })
    expect(events).toEqual(['task.assigned:ed@x.test', 'task.commented:ed@x.test'])
    rule = true
    await runAction(deps, admin, { action: 'save-card', boardId: id, columnId: col.id, card: { title: 'T2', assigneeId: 2 } })
    expect(events).toHaveLength(3)
    expect(ctx.sent).toHaveLength(1)
  })
  it('reminds once per due date, skips done and archived cards, and again after the date changes', async () => {
    const ctx = await boardWithCard({ dueDate: '2027-03-17' })
    const done = await runAction(ctx.deps, admin, { action: 'save-card', boardId: ctx.id, columnId: ctx.cols[3].id, card: { title: 'Finished', assigneeId: 2, dueDate: '2027-03-01' } })
    expect(done.status).toBe(200)
    const events: string[] = []
    const sent: string[] = []
    const now = new Date('2027-03-16T10:00:00Z')
    const deps = { d1: ctx.d1, now, siteName: async () => 'S', textToHtml: (t: string) => t, sendEmail: async (a: { subject: string }) => { sent.push(a.subject) }, emit: async (e: string) => { events.push(e) }, hasRule: async () => false }
    expect(dueSoonCutoff(now)).toBe('2027-03-17')
    expect(await runTaskDueReminders(deps)).toEqual({ reminded: 1 })
    expect(sent).toEqual(['Due soon: Write copy'])
    expect(events).toEqual(['task.due'])
    expect(await runTaskDueReminders(deps)).toEqual({ reminded: 0 })
    await runAction(ctx.deps, admin, { action: 'save-card', boardId: ctx.id, cardId: ctx.cardId, card: { title: 'Write copy', assigneeId: 2, dueDate: '2027-03-16' } })
    expect(await runTaskDueReminders(deps)).toEqual({ reminded: 1 })
    expect(sent[1]).toBe('Due soon: Write copy')
    await runAction(ctx.deps, admin, { action: 'archive-card', boardId: ctx.id, cardId: ctx.cardId })
    await runAction(ctx.deps, admin, { action: 'save-card', boardId: ctx.id, cardId: ctx.cardId, card: { title: 'Write copy', assigneeId: 2, dueDate: '2027-03-10' } })
    expect(await runTaskDueReminders(deps)).toEqual({ reminded: 0 })
  })
})

describe('taskboard entries in the main Activity log', () => {
  it('reads only what one request added and maps it to activity entries', async () => {
    const ctx = setup()
    const id = Number((await runAction(ctx.deps, admin, { action: 'create-board', name: 'Launch' })).body.id)
    const col = (await store.boardData(ctx.d1, id)).columns[0]
    const mark = await store.latestActivityId(ctx.d1)
    const made = await runAction(ctx.deps, admin, { action: 'save-card', boardId: id, columnId: col.id, card: { title: 'Write copy', assigneeId: 2 } })
    await runAction(ctx.deps, admin, { action: 'delete-card', boardId: id, cardId: Number(made.body.id) })
    const rows = await store.activitySince(ctx.d1, mark)
    expect(rows.map((r) => r.action)).toEqual(['card.created', 'card.assigned', 'card.deleted'])
    const entries = rows.map((r) => taskboardAuditEntry(r, { id: 1, email: 'admin@x.test' }))
    expect(entries.map((e) => e.action)).toEqual(['create', 'update', 'delete'])
    expect(entries[0]).toMatchObject({ collectionSlug: 'taskboard', actorEmail: 'admin@x.test', detail: `task created: Write copy (board ${id})` })
    expect(await store.activitySince(ctx.d1, rows[rows.length - 1].id)).toEqual([])
  })
})


describe('taskboard boards scoped to a company or team (18j)', () => {
  it('follows the organisation access helper and checks the company and team pair', async () => {
    const { raw, d1, deps } = setup()
    raw.exec("CREATE TABLE eg_organizations (id text, name text); CREATE TABLE eg_organization_teams (id text, organization_id text, name text); INSERT INTO eg_organizations VALUES ('o1','Acme'),('o2','Beta'); INSERT INTO eg_organization_teams VALUES ('t1','o1','Sales');")
    expect((await runAction(deps, admin, { action: 'create-board', name: 'Bad', organizationId: 'o2', teamId: 't1' })).status).toBe(400)
    expect((await runAction(deps, admin, { action: 'create-board', name: 'Bad', organizationId: 'nope' })).status).toBe(400)
    const wholeId = Number((await runAction(deps, admin, { action: 'create-board', name: 'Acme board', organizationId: 'o1' })).body.id)
    const teamId = Number((await runAction(deps, admin, { action: 'create-board', name: 'Sales board', organizationId: 'o1', teamId: 't1' })).body.id)
    const [whole, team] = [await store.getBoard(d1, wholeId), await store.getBoard(d1, teamId)]
    expect(whole).toMatchObject({ organizationId: 'o1', teamId: null })
    const member = { id: 2, isAdmin: false }
    const plain = { userId: 2, memberships: [{ organizationId: 'o1', role: 'member', teamIds: [] }] }
    const inTeam = { userId: 2, memberships: [{ organizationId: 'o1', role: 'member', teamIds: ['t1'] }] }
    const manager = { userId: 2, memberships: [{ organizationId: 'o1', role: 'admin', teamIds: [] }] }
    expect(canAccessBoard(whole!, member)).toBe(false)
    expect(canAccessBoard(whole!, member, plain)).toBe(true)
    expect(canAccessBoard(team!, member, plain)).toBe(false)
    expect(canAccessBoard(team!, member, inTeam)).toBe(true)
    expect(canAccessBoard(team!, member, manager)).toBe(true)
    expect(canAccessBoard(team!, { id: 9, isAdmin: true })).toBe(true)
    expect((await runAction(deps, { ...editor, orgAccess: plain }, { action: 'save-card', boardId: teamId, columnId: 1, card: { title: 'x' } })).status).toBe(404)
    await runAction(deps, admin, { action: 'update-board', boardId: wholeId, name: 'Acme board', columns: [{ name: 'A' }], organizationId: null, teamId: null })
    expect(await store.getBoard(d1, wholeId)).toMatchObject({ organizationId: null })
    expect((await store.listScopeChoices(d1)).organizations.map((o) => o.id)).toEqual(['o1', 'o2'])
  })
})
