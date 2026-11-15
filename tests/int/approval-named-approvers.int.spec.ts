// @vitest-environment node
/** Task 17e: approval steps can name people, and a named person can approve one author's work. */
import { describe, expect, it } from 'vitest'

import { transition, type ReviewActor, type ReviewDocState } from '@/features/approval/stateMachine'
import { setAuthorRoute, toggleUser } from '@/features/approval/workflowForm'
import { describeAwaiting, mayActOnStep, namedApprovers, namedUserIds, parseAuthorRoutes, parseWorkflow, validateWorkflowInput, type ApprovalWorkflow } from '@/features/approval/workflows'

const NOW = '2026-11-16T10:00:00.000Z'
const ALLOW = { submit: true, comment: true, review: true, publish: true }
const actor = (id: number, roleSlugs: string[], isAdmin = false): ReviewActor => ({ id, name: `User ${id}`, isAdmin, roleSlugs, can: ALLOW })
const inReview = (requestedBy: number, step = 0): ReviewDocState => ({ status: 'in_review', requestedBy, approvals: [], step })

const flow = (over: Partial<ApprovalWorkflow> = {}): ApprovalWorkflow => ({
  id: 1,
  name: 'Named',
  collection: 'pages',
  active: true,
  allowRepeatApprover: false,
  submitterRoles: [],
  steps: [{ name: 'Sign-off', approverRoles: ['editor'], approverNames: ['Bea'], approvalsNeeded: 1, approverUsers: [20], alsoRoles: false }],
  authorRoutes: {},
  ...over,
})
const approve = (workflow: ApprovalWorkflow, who: ReviewActor, state: ReviewDocState) => transition({ state, action: 'approve', actor: who, required: 0, allowSelfApproval: false, workflow, now: NOW })

describe('named approvers', () => {
  it('lets only the named person approve a step, plus admins', () => {
    const wf = flow()
    expect(approve(wf, actor(20, []), inReview(3)).ok).toBe(true)
    const editor = approve(wf, actor(21, ['editor']), inReview(3))
    expect(editor.ok).toBe(false)
    expect(editor.ok === false && editor.error).toContain('Only the named approver')
    expect(approve(wf, actor(1, [], true), inReview(3)).ok).toBe(true)
  })
  it('keeps the role as a fallback when the step says so', () => {
    const wf = flow({ steps: [{ name: 'Sign-off', approverRoles: ['editor'], approverNames: ['Bea'], approvalsNeeded: 1, approverUsers: [20], alsoRoles: true }] })
    expect(approve(wf, actor(21, ['editor']), inReview(3)).ok).toBe(true)
    expect(approve(wf, actor(22, ['viewer']), inReview(3)).ok).toBe(false)
  })
  it('falls back to the roles when nobody is named', () => {
    const wf = flow({ steps: [{ name: 'Sign-off', approverRoles: ['editor'], approverNames: ['Editor'], approvalsNeeded: 1 }] })
    expect(approve(wf, actor(21, ['editor']), inReview(3)).ok).toBe(true)
    expect(approve(wf, actor(20, []), inReview(3)).ok).toBe(false)
  })
  it('routes one author to a named approver and nobody else can approve', () => {
    const wf = flow({ steps: [{ name: 'Review', approverRoles: ['editor'], approverNames: ['Editor'], approvalsNeeded: 1 }], authorRoutes: { '3': [30] } })
    // Author 3's draft: only 30 (and admins).
    expect(approve(wf, actor(30, []), inReview(3)).ok).toBe(true)
    const other = approve(wf, actor(21, ['editor']), inReview(3))
    expect(other.ok).toBe(false)
    expect(other.ok === false && other.error).toContain('named for this author')
    // Another author's draft still goes by role.
    expect(approve(wf, actor(21, ['editor']), inReview(4)).ok).toBe(true)
    expect(approve(wf, actor(30, []), inReview(4)).ok).toBe(false)
  })
  it('stops the named person sending back or withdrawing out of turn', () => {
    const wf = flow()
    const back = transition({ state: inReview(3), action: 'request_changes', actor: actor(21, ['editor']), required: 0, allowSelfApproval: false, workflow: wf, note: 'No', now: NOW })
    expect(back.ok).toBe(false)
  })
  it('names people in the waiting text', () => {
    const wf = parseWorkflow({ id: 5, collection: 'pages', active: true, steps: [{ name: 'Sign-off', approverRoles: ['editor'], approverUsers: [20], approvalsNeeded: 1 }], authorRoutes: { '3': [30] } }, new Map([['editor', 'Editor']]), new Map([[20, 'Bea']]))
    expect(wf && describeAwaiting(wf, 0)).toBe('Step 1 of 1 (Sign-off), waiting on Bea.')
    expect(wf && describeAwaiting(wf, 0, 3)).toContain('named for this author')
    expect(wf && namedApprovers(wf, wf.steps[0], 3)).toEqual([30])
    expect(wf && namedApprovers(wf, wf.steps[0], 9)).toEqual([20])
  })
  it('reads and validates named people', () => {
    expect(parseAuthorRoutes('{"3":[30,"31"],"x":[1],"4":[]}')).toEqual({ '3': [30, 31] })
    expect(namedUserIds([{ approverUsers: [20, 21] }], { '3': [30] }).sort((a, b) => a - b)).toEqual([3, 20, 21, 30])
    const known = new Set([20, 3, 30])
    const base = { name: 'W', collection: 'pages', steps: [{ name: 'S', approverRoles: [] as string[], approverUsers: [20], approvalsNeeded: 1 }] }
    expect(validateWorkflowInput(base, new Set(), [], null, known)).toEqual([])
    expect(validateWorkflowInput({ ...base, steps: [{ name: 'S', approverRoles: [], approvalsNeeded: 1 }] }, new Set(), [], null, known)).toHaveLength(1)
    expect(validateWorkflowInput({ ...base, steps: [{ name: 'S', approverUsers: [99], approvalsNeeded: 1 }] }, new Set(), [], null, known)[0].message).toContain('does not exist')
    expect(validateWorkflowInput({ ...base, authorRoutes: { '3': [3] } }, new Set(), [], null, known)[0].message).toContain('own approver')
  })
  it('edits drafts', () => {
    expect(toggleUser([1], 2)).toEqual([1, 2])
    expect(toggleUser([1, 2], 1)).toEqual([2])
    expect(setAuthorRoute({}, 3, [4])).toEqual({ '3': [4] })
    expect(setAuthorRoute({ '3': [4] }, 3, [])).toEqual({})
    expect(mayActOnStep({ name: 's', approverRoles: ['editor'], approverNames: [], approvalsNeeded: 1 }, ['editor'], false)).toBe(true)
  })
})
