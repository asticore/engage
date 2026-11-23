import { describe, expect, it } from 'vitest'

import { applyEntryQuery, parseEntryQuery, type SubmissionRow } from '@/admin/views/results/rows'

const cols = [{ name: 'dept', label: 'Department' }, { name: 'n', label: 'Count' }]
const row = (id: number, dept: string, n: string, at: string): SubmissionRow => ({ id, submittedAt: at, total: null, paymentStatus: 'none', values: { dept, n } })
const rows = [row(1, 'Sales', '10', '2026-01-01'), row(2, 'Support', '9', '2026-01-02'), row(3, 'sales west', '', '2026-01-03')]

describe('entry query', () => {
  it('ignores unknown fields', () => {
    expect(parseEntryQuery(new URLSearchParams('sort=evil&f_evil=x'), cols)).toEqual({ sort: '', dir: 'desc', filters: {} })
  })
  it('filters by contains, case-insensitive', () => {
    const q = parseEntryQuery(new URLSearchParams('f_dept=SALES'), cols)
    expect(applyEntryQuery(rows, q).map((r) => r.id)).toEqual([1, 3])
  })
  it('sorts numbers as numbers with empties last', () => {
    const q = parseEntryQuery(new URLSearchParams('sort=n&dir=asc'), cols)
    expect(applyEntryQuery(rows, q).map((r) => r.id)).toEqual([2, 1, 3])
  })
})
