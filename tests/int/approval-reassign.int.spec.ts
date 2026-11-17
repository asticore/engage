/**
 * Task 12e: reassigning a review, and stand-ins for reviewers who are away. The state machine and the pure
 * workflow helpers only (no database).
 */
import { describe, expect, it } from 'vitest'

import { parseStoredReview, serializeStoredReview, transition, resetOnEdit, type ReviewActor, type ReviewDocState } from '@/features/approval/stateMachine'
import { coveredBy, describeAwaiting, isAway, mayActOnStep, namedApprovers, namedUserIds, parseSectionRoutes, parseStandIns, validateWorkflowInput, type ApprovalWorkflow } from '@/features/approval/workflows'
import { approverCandidates, draftFromRecord, payloadFromDraft, setSectionRoute, setStandIn } from '@/features/approval/workflowForm'
import { sectionKeyOf } from '@/features/approval/sections'

describe('approver picker candidates', () => {
  it('includes staff and custom-role holders, leaves out plain customers', () => {
    const list = approverCandidates([
      { id: 1, name: 'Admin', roles: ['admin'] },
      { id: 2, name: 'Cus', roles: ['customer'] },
      { id: 3, email: 'legal@example.com', roles: ['customer'], customRole: 5 },
      { id: 4, name: ' Pop ', roles: [], customRole: { id: 6 } },
      { id: 5, roles: [] },
      { id: 'x', roles: ['admin'] },
    ])
    expect(list).toEqual([
      { id: 1, name: 'Admin' },
      { id: 3, name: 'legal@example.com' },
      { id: 4, name: 'Pop' },
    ])
  })
})

const NOW = '2026-11-17T10:00:00.000Z'

const FLOW: ApprovalWorkflow = {
  id: 7,
  name: 'Editorial then legal',
  collection: 'pages',
  active: true,
  allowRepeatApprover: false,
  submitterRoles: [],
  steps: [
    { name: 'Editor review', approverRoles: ['editor'], approverNames: ['Editor'], approvalsNeeded: 2 },
    { name: 'Legal review', approverRoles: ['legal'], approverNames: ['Legal'], approvalsNeeded: 1 },
  ],
}

const actor = (id: number, roleSlugs: string[], overrides: Partial<ReviewActor> = {}): ReviewActor => ({
  id,
  name: `User ${id}`,
  isAdmin: false,
  roleSlugs,
  can: { submit: true, comment: true, review: true, publish: true },
  ...overrides,
})

const inReview = (overrides: Partial<ReviewDocState> = {}): ReviewDocState => ({ status: 'in_review', requestedBy: 3, approvals: [], step: 0, ...overrides })

const run = (state: ReviewDocState, action: Parameters<typeof transition>[0]['action'], who: ReviewActor, extra: Partial<Parameters<typeof transition>[0]> = {}) =>
  transition({ state, action, actor: who, required: 0, allowSelfApproval: false, workflow: FLOW, now: NOW, ...extra })

describe('reassigning a review', () => {
  it('a step approver hands the review to someone, with a history row naming them', () => {
    const result = run(inReview(), 'reassign', actor(5, ['editor']), { assignTo: { userId: 9, name: 'Nia' } })
    expect(result).toMatchObject({ ok: true, state: { status: 'in_review', assignee: { userId: 9, name: 'Nia' } } })
    expect(result.ok && result.events).toEqual([{ action: 'reassigned', note: 'Handed to Nia.', step: 'Editor review' }])
  })

  it('the person it was handed to may then approve, even without the step role', () => {
    const state = inReview({ assignee: { userId: 9, name: 'Nia' } })
    expect(run(state, 'approve', actor(9, []))).toMatchObject({ ok: true })
    expect(run(state, 'approve', actor(10, []))).toMatchObject({ ok: false, status: 403 })
    // The usual approvers still may.
    expect(run(state, 'approve', actor(5, ['editor']))).toMatchObject({ ok: true })
  })

  it('a reviewer who cannot act on the step cannot reassign it; admins always can', () => {
    expect(run(inReview(), 'reassign', actor(8, ['legal']), { assignTo: { userId: 9, name: 'Nia' } })).toMatchObject({ ok: false, status: 403 })
    expect(run(inReview(), 'reassign', actor(1, ['admin'], { isAdmin: true }), { assignTo: { userId: 9, name: 'Nia' } })).toMatchObject({ ok: true })
  })

  it('refuses a document that is not in review, the same person twice, and the submitter', () => {
    expect(run({ status: 'none', requestedBy: null, approvals: [] }, 'reassign', actor(5, ['editor']), { assignTo: { userId: 9, name: 'Nia' } })).toMatchObject({ ok: false, status: 409 })
    expect(run(inReview({ assignee: { userId: 9, name: 'Nia' } }), 'reassign', actor(5, ['editor']), { assignTo: { userId: 9, name: 'Nia' } })).toMatchObject({ ok: false, status: 409 })
    expect(run(inReview(), 'reassign', actor(5, ['editor']), { assignTo: { userId: 3, name: 'Author' } })).toMatchObject({ ok: false, status: 400 })
  })

  it('handing it back clears the assignee; with none set there is nothing to hand back', () => {
    const handed = inReview({ assignee: { userId: 9, name: 'Nia' } })
    expect(run(handed, 'reassign', actor(5, ['editor']), { assignTo: null })).toMatchObject({ ok: true, state: { assignee: null } })
    expect(run(inReview(), 'reassign', actor(5, ['editor']), { assignTo: null })).toMatchObject({ ok: false, status: 409 })
  })

  it('the assignee survives a partial approval but not the move to the next step, a send back or a withdraw', () => {
    const handed = inReview({ assignee: { userId: 9, name: 'Nia' } })
    // Step 1 needs 2 approvals: the first keeps the assignee.
    expect(run(handed, 'approve', actor(5, ['editor']))).toMatchObject({ ok: true, state: { step: 0, assignee: { userId: 9 } } })
    const second = run(inReview({ assignee: { userId: 9, name: 'Nia' }, approvals: [{ userId: 5, name: 'A', at: NOW }] }), 'approve', actor(6, ['editor']))
    expect(second.ok && second.state.assignee).toBeUndefined()
    const sentBack = run(handed, 'request_changes', actor(9, []), { note: 'fix' })
    expect(sentBack.ok && sentBack.state.assignee).toBeUndefined()
    const withdrawn = run(handed, 'withdraw', actor(3, []))
    expect(withdrawn.ok && withdrawn.state.assignee).toBeUndefined()
  })

  it('editing the content starts the review again and drops the assignee, a plain save keeps it', () => {
    const handed = inReview({ assignee: { userId: 9, name: 'Nia' } })
    expect(resetOnEdit(handed, true).assignee).toBeUndefined()
    expect(resetOnEdit(handed, false).assignee).toEqual({ userId: 9, name: 'Nia' })
  })

  it('is stored with the approvals and read back', () => {
    const stored = serializeStoredReview({ hash: 'abc', approvals: [], assignee: { userId: 9, name: 'Nia' } })
    expect(parseStoredReview(stored)).toMatchObject({ hash: 'abc', assignee: { userId: 9, name: 'Nia' } })
    // Without an assignee the stored shape is unchanged.
    expect(serializeStoredReview({ hash: null, approvals: [] })).toEqual([])
    expect(parseStoredReview([]).assignee).toBeUndefined()
  })
})

describe('a person per section', () => {
  const step = FLOW.steps[0]
  const routed: ApprovalWorkflow = { ...FLOW, sectionRoutes: { '12': [7], news: [8] }, authorRoutes: { '3': [9] } }

  it('reads routes with keys trimmed and lower-cased, dropping empty ones', () => {
    expect(parseSectionRoutes({ ' News ': [8, '8'], '': [1], blank: [], bad: 'x' })).toEqual({ news: [8] })
    expect(parseSectionRoutes('nope')).toEqual({})
  })

  it('the section route replaces the step approvers; an author route still wins; no section means the step decides', () => {
    expect(namedApprovers(routed, step, 4, '12')).toEqual([7])
    expect(namedApprovers(routed, step, 3, '12')).toEqual([9])
    expect(namedApprovers(routed, step, 4, null)).toEqual([])
    expect(namedApprovers(routed, step, 4, 'other')).toEqual([])
  })

  it('only the named person (or an admin) may approve a routed section, and the message says so', () => {
    const state = inReview({ requestedBy: 4, section: '12' })
    expect(run(state, 'approve', actor(7, []), { workflow: routed })).toMatchObject({ ok: true })
    const blocked = run(state, 'approve', actor(5, ['editor']), { workflow: routed })
    expect(blocked).toMatchObject({ ok: false, status: 403 })
    expect(blocked).toMatchObject({ error: expect.stringContaining('the approver named for this section') })
    expect(run(state, 'approve', actor(1, ['admin'], { isAdmin: true }), { workflow: routed })).toMatchObject({ ok: true })
    // A document in another section is decided by the step's roles.
    expect(run(inReview({ requestedBy: 4, section: 'other' }), 'approve', actor(5, ['editor']), { workflow: routed })).toMatchObject({ ok: true })
  })

  it('says who is awaited', () => {
    expect(describeAwaiting(routed, 0, 4, '12')).toContain('the approver named for this section')
    expect(describeAwaiting(routed, 0, 3, '12')).toContain('the approver named for this author')
    expect(describeAwaiting(routed, 0, 4, null)).toContain('Editor')
  })

  it('works out a page section from its top-level page and a post section from its first category', async () => {
    const pages: Record<number, Record<string, unknown>> = { 12: { id: 12, parent: null }, 20: { id: 20, parent: 12 }, 21: { id: 21, parent: { id: 20 } } }
    const engine = {
      findByID: async (args: Record<string, unknown>): Promise<Record<string, unknown> | null> => pages[Number(args.id)] ?? null,
      find: async (): Promise<{ docs: Array<Record<string, unknown>> }> => ({ docs: [] }),
    }
    expect(await sectionKeyOf(engine, 'pages', { id: 21, parent: 20 })).toBe('12')
    expect(await sectionKeyOf(engine, 'pages', { id: 12 })).toBe('12')
    expect(await sectionKeyOf(engine, 'posts', { id: 1, categories: [{ name: ' News ' }, { name: 'Other' }] })).toBe('news')
    expect(await sectionKeyOf(engine, 'posts', { id: 1, categories: [] })).toBeNull()
    expect(await sectionKeyOf(engine, 'events', { id: 1 })).toBeNull()
  })

  it('validates the named people, and the form adds and removes rows', () => {
    const base = { name: 'W', collection: 'pages', steps: [{ name: 'S', approverRoles: ['editor'], approvalsNeeded: 1 }] }
    const messages = (routes: unknown) => validateWorkflowInput({ ...base, sectionRoutes: routes }, new Set(['editor']), [], null, new Set([7])).map((p) => p.message)
    expect(messages({ '12': [7] })).toEqual([])
    expect(messages({ '12': [99] })).toContain('Approver by section "12": user 99 does not exist.')
    expect(namedUserIds([], {}, [], { '12': [7] })).toEqual([7])
    expect(setSectionRoute({}, ' News ', [8])).toEqual({ news: [8] })
    expect(setSectionRoute({ news: [8] }, 'news', [])).toEqual({})
    expect(payloadFromDraft(draftFromRecord({ id: 1, name: 'W', collection: 'pages', steps: [], sectionRoutes: { news: [8] } })).sectionRoutes).toEqual({ news: [8] })
  })
})

describe('stand-ins', () => {
  const standIns = parseStandIns([
    { userId: 4, standInId: 8, until: '2026-11-20' },
    { userId: 5, standInId: 8, until: null },
  ])

  it('reads rows defensively: bad users, self cover, repeats and bad dates', () => {
    expect(parseStandIns('not json')).toEqual([])
    expect(
      parseStandIns([
        { userId: 4, standInId: 4, until: null },
        { userId: 'x', standInId: 8 },
        { userId: 4, standInId: 8, until: 'tomorrow' },
        { userId: 4, standInId: 9, until: '2026-11-20' },
      ]),
    ).toEqual([{ userId: 4, standInId: 8, until: null }])
  })

  it('covers while away: until the last day inclusive, or until removed', () => {
    expect(isAway(standIns[0], '2026-11-20')).toBe(true)
    expect(isAway(standIns[0], '2026-11-21')).toBe(false)
    expect(coveredBy(standIns, 8, '2026-11-17')).toEqual([4, 5])
    expect(coveredBy(standIns, 8, '2026-12-01')).toEqual([5])
    expect(coveredBy(standIns, 3, '2026-11-17')).toEqual([])
  })

  it('a stand-in acts for the away reviewer: their role, or their name on a named step', () => {
    const step = FLOW.steps[0]
    // Role step: the away person held the editor role.
    expect(mayActOnStep(step, [], false, { userId: 8, named: [] })).toBe(false)
    expect(run(inReview(), 'approve', actor(8, [], { coveringFor: { userIds: [4], roleSlugs: ['editor'] } }))).toMatchObject({ ok: true })
    expect(run(inReview(), 'approve', actor(8, []))).toMatchObject({ ok: false, status: 403 })
    // Named step: the away person is the named approver.
    const named = { ...step, approverUsers: [4] }
    expect(mayActOnStep(named, [], false, { userId: 8, named: [4] })).toBe(false)
    expect(mayActOnStep(named, [], false, { userId: 8, named: [4], alsoUserIds: [4] })).toBe(true)
  })

  it('cover is not extra rights: the stand-in still needs permission to review at all', () => {
    const noReview = actor(8, [], { can: { submit: true, comment: true, review: false, publish: false }, coveringFor: { userIds: [4], roleSlugs: ['editor'] } })
    expect(run(inReview(), 'approve', noReview)).toMatchObject({ ok: false, status: 403 })
  })

  it('validates: needs both people, real users, one row per reviewer, a real date', () => {
    const base = { name: 'W', collection: 'pages', steps: [{ name: 'S', approverRoles: ['editor'], approvalsNeeded: 1 }] }
    const known = new Set(['editor'])
    const users = new Set([4, 8])
    const messages = (list: unknown) => validateWorkflowInput({ ...base, standIns: list }, known, [], null, users).map((p) => p.message)
    expect(messages([{ userId: 4, standInId: 8, until: '2026-11-20' }])).toEqual([])
    expect(messages([{ userId: 4, standInId: 4 }])).toContain('A reviewer cannot be their own stand-in.')
    expect(messages([{ userId: 4, standInId: 99 }])).toContain('Stand-in: user 99 does not exist.')
    expect(messages([{ userId: 4, standInId: 8, until: 'soon' }])).toContain('Stand-in: the away until date is not valid.')
    expect(messages([{ userId: 4, standInId: 8 }, { userId: 4, standInId: 8 }])).toContain('Each reviewer can have only one stand-in.')
    expect(messages([{}])).toContain('Stand-in: pick the reviewer and the person who covers.')
  })

  it('their users are read with the workflow, and the form adds and removes rows', () => {
    expect(namedUserIds([], {}, [{ userId: 4, standInId: 8 }]).sort()).toEqual([4, 8])
    let list = setStandIn([], 4, 8, '2026-11-20')
    list = setStandIn(list, 4, 9, null)
    expect(list).toEqual([{ userId: 4, standInId: 9, until: null }])
    expect(setStandIn(list, 4, null, null)).toEqual([])
    const draft = draftFromRecord({ id: 1, name: 'W', collection: 'pages', steps: [], standIns: [{ userId: 4, standInId: 8, until: null }] })
    expect(payloadFromDraft(draft).standIns).toEqual([{ userId: 4, standInId: 8, until: null }])
  })
})
