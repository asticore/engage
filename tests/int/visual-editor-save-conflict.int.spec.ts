import { describe, expect, it } from 'vitest'

import { savedByAnotherSince, updatedAtFromSave } from '@/views/visualEditor/saveConflict'

describe('savedByAnotherSince', () => {
  it('is true only when the server stamp is newer than the loaded one', () => {
    expect(savedByAnotherSince('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(true)
    expect(savedByAnotherSince('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false)
    expect(savedByAnotherSince('2025-12-31T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false)
  })

  it('never blocks a save on missing or unreadable stamps', () => {
    expect(savedByAnotherSince(undefined, '2026-01-01T00:00:00.000Z')).toBe(false)
    expect(savedByAnotherSince('2026-01-01T00:00:00.000Z', null)).toBe(false)
    expect(savedByAnotherSince('not a date', '2026-01-01T00:00:00.000Z')).toBe(false)
  })
})

describe('updatedAtFromSave', () => {
  it('reads doc (collections) and result (globals)', () => {
    expect(updatedAtFromSave({ doc: { updatedAt: 'a' } })).toBe('a')
    expect(updatedAtFromSave({ result: { updatedAt: 'b' } })).toBe('b')
  })

  it('returns undefined for anything else', () => {
    expect(updatedAtFromSave(null)).toBeUndefined()
    expect(updatedAtFromSave({ doc: {} })).toBeUndefined()
    expect(updatedAtFromSave('x')).toBeUndefined()
  })
})
