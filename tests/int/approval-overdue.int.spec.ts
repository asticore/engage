import { describe, expect, it } from 'vitest'

import { dueAt, isOverdue, OVERDUE_NOTE } from '@/features/approval/overdue'
import { parseWorkflow } from '@/features/approval/workflows'

describe('overdue reviews', () => {
  const now = new Date('2026-11-17T00:00:00Z')
  it('works out the due date from the request and the days', () => {
    expect(dueAt('2026-11-10T00:00:00Z', 3)?.toISOString()).toBe('2026-11-13T00:00:00.000Z')
    expect(dueAt('2026-11-10T00:00:00Z', 0)).toBeNull()
    expect(dueAt(null, 3)).toBeNull()
    expect(dueAt('nonsense', 3)).toBeNull()
  })
  it('is overdue only past the due date', () => {
    expect(isOverdue('2026-11-10T00:00:00Z', 7, now)).toBe(true)
    expect(isOverdue('2026-11-12T00:00:00Z', 7, now)).toBe(false)
    expect(isOverdue('2026-11-01T00:00:00Z', 0, now)).toBe(false)
  })
  it('reads the due days from a workflow row and keeps them in range', () => {
    const row = { id: 1, name: 'W', collection: 'pages', active: true, steps: [{ name: 'A', approverRoles: ['editor'], approvalsNeeded: 1 }] }
    expect(parseWorkflow({ ...row, reviewDueDays: 5 })?.reviewDueDays).toBe(5)
    expect(parseWorkflow({ ...row, reviewDueDays: 9999 })?.reviewDueDays).toBe(365)
    expect(parseWorkflow(row)?.reviewDueDays).toBe(0)
  })
  it('marks reminders with a fixed note', () => {
    expect(OVERDUE_NOTE).toBe('Overdue reminder sent')
  })
})
