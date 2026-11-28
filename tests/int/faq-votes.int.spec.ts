// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { parseVote, recordVote, voteTotals, voterHash, type VoteD1 } from '../../src/features/faq/votes'

describe('faq votes', () => {
  it('accepts only an integer id and a boolean', () => {
    expect(parseVote({ id: 3, helpful: true })).toEqual({ id: 3, helpful: true })
    expect(parseVote({ id: '3', helpful: true })).toBeNull()
    expect(parseVote({ id: 0, helpful: true })).toBeNull()
    expect(parseVote({ id: 1, helpful: 'yes' })).toBeNull()
    expect(parseVote(null)).toBeNull()
  })
  it('hashes the voter per question without keeping the address', async () => {
    const a = await voterHash('1.2.3.4', 1)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toContain('1.2.3.4')
    expect(await voterHash('1.2.3.4', 2)).not.toBe(a)
    expect(await voterHash('1.2.3.4', 1)).toBe(a)
  })
  it('writes one upsert per vote and reads totals', async () => {
    const calls: { sql: string; args: unknown[] }[] = []
    const d1: VoteD1 = {
      prepare: (sql) => ({
        bind: (...args) => {
          calls.push({ sql, args })
          return { run: async () => undefined, all: async <T,>() => ({ results: [{ faq_id: 1, yes: 2, no: 1 }] as unknown as T[] }) }
        },
      }),
    }
    await recordVote(d1, { id: 1, helpful: false }, 'abc', '2026-11-28T00:00:00Z')
    expect(calls[0].sql).toContain('ON CONFLICT(faq_id, voter)')
    expect(calls[0].args).toEqual([1, 'abc', 0, '2026-11-28T00:00:00Z'])
    expect(await voteTotals(d1)).toEqual({ 1: { yes: 2, no: 1 } })
  })
})
