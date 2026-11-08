import { describe, expect, it } from 'vitest'
import type { SectionNode } from '@/lib/sectionTree'
import {
  createHistory,
  historyRows,
  jumpHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
  type Snapshot,
} from '@/views/visualEditor/history'
import { resolveShortcut, SHORTCUT_LIST } from '@/views/visualEditor/useEditorShortcuts'

const snap = (n: number): Snapshot => ({ blocks: [{ blockType: 'section', n } as unknown as SectionNode], selectedPath: null })
const n = (s: Snapshot) => (s.blocks[0] as unknown as { n: number }).n

/** States 0..5 on screen; each step i -> i+1 was made by the action labelled `Step i+1`. Returns history with 5 past entries. */
const fiveEdits = (): History => {
  let h = createHistory()
  for (let i = 0; i < 5; i += 1) h = pushHistory(h, snap(i), { now: i * 10_000, label: `Step ${i + 1}` })
  return h
}

describe('history labels', () => {
  it('stores the label on the pushed entry', () => {
    const h = pushHistory(createHistory(), snap(0), { now: 0, label: 'Added Heading' })
    expect(h.past[0].label).toBe('Added Heading')
  })

  it('leaves entries without a label alone', () => {
    const h = pushHistory(createHistory(), snap(0), { now: 0 })
    expect(h.past[0].label).toBeUndefined()
  })

  it('keeps the existing entry (and its label) when edits coalesce', () => {
    let h = pushHistory(createHistory(), snap(0), { now: 0, key: 'edit:0', label: 'Edited Heading' })
    h = pushHistory(h, snap(1), { now: 100, key: 'edit:0', label: 'Edited Heading again' })
    expect(h.past).toHaveLength(1)
    expect(h.past[0].label).toBe('Edited Heading')
  })

  it('hands the label back and forth between undo and redo', () => {
    const h = fiveEdits()
    const undone = undoHistory(h, snap(5))!
    expect(undone.history.future[0].label).toBe('Step 5')
    const redone = redoHistory(undone.history, undone.snapshot)!
    expect(redone.history.past).toHaveLength(5)
    expect(redone.history.past[4].label).toBe('Step 5')
    expect(n(redone.snapshot)).toBe(5)
  })
})

describe('jumpHistory', () => {
  it('jumps back several steps and keeps the skipped states for redo', () => {
    const h = fiveEdits()
    const result = jumpHistory(h, snap(5), -3)!
    expect(n(result.snapshot)).toBe(2)
    expect(result.history.past).toHaveLength(2)
    expect(result.history.future.map((s) => n(s))).toEqual([5, 4, 3])
  })

  it('jumps forward after jumping back', () => {
    const h = fiveEdits()
    const back = jumpHistory(h, snap(5), -4)!
    const forward = jumpHistory(back.history, back.snapshot, 3)!
    expect(n(forward.snapshot)).toBe(4)
    expect(forward.history.past).toHaveLength(4)
    expect(forward.history.future).toHaveLength(1)
  })

  it('a jump equals the same number of single undos', () => {
    const h = fiveEdits()
    let single = { history: h, snapshot: snap(5) }
    for (let i = 0; i < 2; i += 1) single = undoHistory(single.history, single.snapshot)!
    expect(jumpHistory(h, snap(5), -2)).toEqual(single)
  })

  it('returns null for zero, too many steps, or a non-integer', () => {
    const h = fiveEdits()
    expect(jumpHistory(h, snap(5), 0)).toBeNull()
    expect(jumpHistory(h, snap(5), -6)).toBeNull()
    expect(jumpHistory(h, snap(5), 1)).toBeNull()
    expect(jumpHistory(h, snap(5), 1.5)).toBeNull()
  })
})

describe('historyRows', () => {
  it('has a single current row for a fresh history', () => {
    expect(historyRows(createHistory())).toEqual([{ id: 'current', label: null, steps: 0 }])
  })

  it('lists the start, one row per action and marks the current state', () => {
    const rows = historyRows(fiveEdits())
    expect(rows.map((r) => r.label)).toEqual([null, 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'])
    expect(rows.map((r) => r.steps)).toEqual([-5, -4, -3, -2, -1, 0])
    expect(rows.filter((r) => r.steps === 0)).toHaveLength(1)
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
  })

  it('every row jumps to the state its label names', () => {
    const h = fiveEdits()
    for (const row of historyRows(h)) {
      const landed = row.steps === 0 ? snap(5) : jumpHistory(h, snap(5), row.steps)!.snapshot
      expect(n(landed)).toBe(5 + row.steps)
    }
  })

  it('shows redo rows after the current one, nearest first, and they stay clickable', () => {
    const h = fiveEdits()
    const back = jumpHistory(h, snap(5), -3)!
    const rows = historyRows(back.history)
    expect(rows.map((r) => r.label)).toEqual([null, 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'])
    expect(rows.map((r) => r.steps)).toEqual([-2, -1, 0, 1, 2, 3])
    const forward = jumpHistory(back.history, back.snapshot, 2)!
    expect(n(forward.snapshot)).toBe(4)
  })
})

describe('history shortcut', () => {
  const k = (key: string, o: Partial<{ ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }> = {}) => ({
    key,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    ...o,
  })

  it('Mod+Shift+H opens the history panel', () => {
    expect(resolveShortcut(k('H', { ctrl: true, shift: true }))).toBe('history')
    expect(resolveShortcut(k('h', { meta: true, shift: true }))).toBe('history')
  })

  it('plain H and Mod+H do not', () => {
    expect(resolveShortcut(k('h'))).toBeNull()
    expect(resolveShortcut(k('h', { ctrl: true }))).toBeNull()
  })

  it('is listed in the shortcuts help', () => {
    expect(SHORTCUT_LIST.some((item) => item.labelKey === 've.shortcut.history')).toBe(true)
  })
})
