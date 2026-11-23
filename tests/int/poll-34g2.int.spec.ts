import { describe, expect, it } from 'vitest'

import { cleanChoice, cleanPollId, percent, toResults } from '@/features/polls/core'
import { getElementDef } from '@/lib/elements/registry'

describe('34g2 poll', () => {
  it('registers', () => expect(getElementDef('poll')).toBeTruthy())
  it('cleans ids and choices', () => {
    expect(cleanPollId('poll-1_a')).toBe('poll-1_a')
    expect(cleanPollId('bad id!')).toBeNull()
    expect(cleanChoice(2, 3)).toBe(2)
    expect(cleanChoice(3, 3)).toBeNull()
    expect(cleanChoice(-1)).toBeNull()
    expect(cleanChoice('x')).toBeNull()
  })
  it('totals results and ignores out of range rows', () => {
    const r = toResults([{ choice: 0, n: 3 }, { choice: 1, n: 1 }, { choice: 9, n: 5 }], 3)
    expect(r).toEqual({ counts: [3, 1, 0], total: 4 })
    expect(percent(3, 4)).toBe(75)
    expect(percent(0, 0)).toBe(0)
  })
})
