import { afterEach, describe, expect, it } from 'vitest'

import {
  createDragFallback,
  currentLibraryDrag,
  endLibraryDrag,
  readLibraryDrag,
  startLibraryDrag,
  trackLibraryDrag,
  VE_BLOCK_MIME,
  VE_TEMPLATE_LOCKS_TYPE,
  VE_TEMPLATE_MIME,
  type DropSlot,
} from '@/views/visualEditor/dropSlot'

const slot: DropSlot = { containerPath: [0, 1], at: 2, key: '0.1|2' }

/** A DataTransfer stand-in that keeps what dragstart wrote. */
const fakeDt = (readable = true) => {
  const data = new Map<string, string>()
  return {
    effectAllowed: 'uninitialized',
    setData: (type: string, value: string): void => void data.set(type, value),
    getData: (type: string): string => (readable ? (data.get(type) ?? '') : ''),
    types: data as unknown as ReadonlyArray<string>,
  }
}

afterEach(() => endLibraryDrag())

describe('library drag payload', () => {
  it('writes the custom type, copy effect and the in-memory payload on dragstart', () => {
    const dt = fakeDt()
    startLibraryDrag(dt as unknown as DataTransfer, { kind: 'block', slug: 'element:heading' })
    expect(dt.getData(VE_BLOCK_MIME)).toBe('element:heading')
    expect(dt.effectAllowed).toBe('copy')
    expect(currentLibraryDrag()).toEqual({ kind: 'block', slug: 'element:heading' })
  })

  it('writes templates with their locks', () => {
    const dt = fakeDt()
    startLibraryDrag(dt as unknown as DataTransfer, { kind: 'template', blocksJson: '[]', locksJson: '{"nodes":{}}' })
    expect(dt.getData(VE_TEMPLATE_MIME)).toBe('[]')
    expect(dt.getData(VE_TEMPLATE_LOCKS_TYPE)).toBe('{"nodes":{}}')
  })

  it('reads the DataTransfer when it is readable', () => {
    const dt = fakeDt()
    startLibraryDrag(dt as unknown as DataTransfer, { kind: 'block', slug: 'section' })
    expect(readLibraryDrag(dt)).toEqual({ kind: 'block', slug: 'section' })
  })

  it('falls back to the in-memory payload when the browser hides the data (Safari / Firefox)', () => {
    startLibraryDrag(fakeDt() as unknown as DataTransfer, { kind: 'block', slug: 'element:button' })
    expect(readLibraryDrag(fakeDt(false))).toEqual({ kind: 'block', slug: 'element:button' })
    expect(readLibraryDrag(null)).toEqual({ kind: 'block', slug: 'element:button' })
  })

  it('has nothing after dragend clears it', () => {
    startLibraryDrag(null, { kind: 'block', slug: 'x' })
    endLibraryDrag()
    expect(readLibraryDrag(fakeDt(false))).toBeNull()
  })

  it('survives a browser that throws from setData', () => {
    const dt = {
      effectAllowed: 'none',
      setData: () => {
        throw new Error('nope')
      },
    }
    expect(() => startLibraryDrag(dt as unknown as DataTransfer, { kind: 'block', slug: 'a' })).not.toThrow()
    expect(currentLibraryDrag()).toEqual({ kind: 'block', slug: 'a' })
  })
})

describe('drag end fallback', () => {
  const payload = { kind: 'block', slug: 'element:heading' } as const

  it('inserts at the last hovered slot when no drop event arrived', () => {
    const f = createDragFallback()
    f.start(payload)
    f.hover(slot)
    expect(f.end()).toEqual({ payload, slot })
  })

  it('does nothing after a handled drop', () => {
    const f = createDragFallback()
    f.start(payload)
    f.hover(slot)
    f.drop()
    expect(f.end()).toBeNull()
  })

  it('does nothing when the pointer left the canvas or no slot was valid', () => {
    const f = createDragFallback()
    f.start(payload)
    f.hover(slot)
    f.leave()
    expect(f.end()).toBeNull()
    f.start(payload)
    f.hover(null)
    expect(f.end()).toBeNull()
  })

  it('resets between drags', () => {
    const f = createDragFallback()
    f.start(payload)
    f.hover(slot)
    f.end()
    expect(f.end()).toBeNull()
    f.start(payload)
    expect(f.end()).toBeNull()
  })
})

describe('trackLibraryDrag', () => {
  it('goes active from the in-memory payload even when types are hidden, and inactive on dragend', () => {
    const seen: boolean[] = []
    const unbind = trackLibraryDrag(document, (a) => seen.push(a))
    startLibraryDrag(null, { kind: 'block', slug: 'x' })
    const start = new Event('dragstart', { bubbles: true })
    document.body.dispatchEvent(start)
    document.body.dispatchEvent(new Event('dragend', { bubbles: true }))
    unbind()
    expect(seen).toEqual([true, false])
  })
})
