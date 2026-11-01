import { describe, it, expect } from 'vitest'
import { parseCsv } from '@/features/redirects/csv'

describe('redirect CSV import with quoted newlines', () => {
  it('keeps a line break inside a quoted note on the same row', () => {
    const text = 'fromPath,toPath,redirectType,enabled,note\r\n/old-a,/new-a,301,true,"first line\nsecond ""quoted"" line"\r\n/old-b,/new-b,302,true,plain\r\n'
    const result = parseCsv(text)
    expect(result.errors).toEqual([])
    expect(result.rows.map((r) => [r.fromPath, r.toPath, r.note])).toEqual([
      ['/old-a', '/new-a', 'first line\nsecond "quoted" line'],
      ['/old-b', '/new-b', 'plain'],
    ])
  })
})
