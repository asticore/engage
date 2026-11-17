import { describe, expect, it } from 'vitest'

import { reminderMarker, runQuoteSweep } from '@/features/quotes/expiry'

const row = (id: number, validUntil: string, activity: unknown[] = []): Record<string, unknown> => ({
  id, number: `Q${id}`, kind: 'quote', status: 'quoted', name: 'Sam', email: 's@example.com', phone: '', quantity: 1, details: '', deadline: '', currency: 'AUD',
  quote_lines: '[]', quote_total_cents: 12000, valid_until: validUntil, terms: '', counter_note: '', activity: JSON.stringify(activity), created_at: '2026-11-01T00:00:00Z',
})

describe('quote expiry sweep', () => {
  it('emails once per validity date and notes it', async (): Promise<void> => {
    const now = new Date('2026-11-17T00:00:00Z')
    const soon = '2026-11-19T00:00:00.000Z'
    const rows = [row(1, soon), row(2, soon, [{ at: 'x', by: 'system', text: reminderMarker(soon) }])]
    const written: unknown[][] = []
    const d1 = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async <T>(): Promise<{ results: T[] }> => ({ results: (sql.includes('valid_until >') ? rows : rows.filter((r) => String(r.id) === String(args[0]))) as T[] }),
          run: async (): Promise<{ meta: { changes: number } }> => {
            written.push([sql, ...args])
            return { meta: { changes: 0 } }
          },
        }),
      }),
    }
    const sent: string[] = []
    const result = await runQuoteSweep(d1, now, 'Shop', async (mail): Promise<void> => {
      sent.push(mail.subject)
    })
    expect(result.reminded).toBe(1)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('Q1')
    expect(written.some((w) => String(w[0]).includes('SET activity'))).toBe(true)
  })
})
