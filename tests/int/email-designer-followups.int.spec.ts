import { describe, expect, it } from 'vitest'

import { COALESCE_MS, emptyHistory, HISTORY_LIMIT, recordEdit, redo, undo } from '@/admin/views/email-designer/designerHistory'
import { DEFAULT_EMAIL_BRAND } from '@/features/email/design/brand'
import { contrastRatio, lintEmail } from '@/features/email/design/lint'
import type { EmailBlock } from '@/features/email/design/types'

const text = (t: string): EmailBlock => ({ type: 'text', text: t, align: 'left' })
const codes = (blocks: EmailBlock[], brand = DEFAULT_EMAIL_BRAND) => lintEmail(blocks, { brand }).map((w) => w.code)

describe('designer undo and redo', () => {
  it('steps back and forward, and a new edit clears redo', () => {
    let h = recordEdit(emptyHistory<string>(), 'a', 1000)
    h = recordEdit(h, 'b', 1000 + COALESCE_MS + 1)
    const back = undo(h, 'c')!
    expect(back.value).toBe('b')
    const again = undo(back.history, 'b')!
    expect(again.value).toBe('a')
    expect(undo(again.history, 'a')).toBeNull()
    const fwd = redo(again.history, 'a')!
    expect(fwd.value).toBe('b')
    expect(recordEdit(fwd.history, 'x', 99999).future).toEqual([])
  })
  it('counts a burst of typing as one step and caps the history', () => {
    let h = emptyHistory<number>()
    for (let i = 0; i < 10; i += 1) h = recordEdit(h, i, 1000 + i * 10)
    expect(h.past).toEqual([0])
    let long = emptyHistory<number>()
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) long = recordEdit(long, i, i * (COALESCE_MS + 1))
    expect(long.past).toHaveLength(HISTORY_LIMIT)
  })
})

describe('dark mode and contrast checks', () => {
  it('measures contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 1)
  })
  it('stays quiet for the default brand with no links', () => {
    expect(codes([text('Hello')])).toEqual([])
  })
  it('flags unreadable text, pure black text, a logo and dim links in dark mode', () => {
    expect(codes([text('Hello')], { ...DEFAULT_EMAIL_BRAND, textColor: '#bbbbbb' })).toContain('low-contrast')
    expect(codes([text('Hello')], { ...DEFAULT_EMAIL_BRAND, textColor: '#000000' })).toContain('dark-pure')
    expect(codes([text('Hello')], { ...DEFAULT_EMAIL_BRAND, logoUrl: 'https://example.com/l.png' })).toContain('dark-logo')
    const link = text('See [your order](https://example.com/o)')
    expect(codes([link], { ...DEFAULT_EMAIL_BRAND, accent: '#1a3c34' })).toContain('dark-link')
    expect(codes([link], { ...DEFAULT_EMAIL_BRAND, accent: '#7fd1b9' })).not.toContain('dark-link')
  })
})
