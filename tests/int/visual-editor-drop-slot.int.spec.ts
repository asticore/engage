import { describe, expect, it } from 'vitest'

import {
  clientToFrame,
  isLibraryDragTypes,
  resolveDropSlotInDoc,
  resolveSlotFromElement,
} from '@/views/visualEditor/dropSlot'

const rectOf = (top: number, height: number) =>
  ({ top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top, toJSON: (): object => ({}) }) as DOMRect

const build = () => {
  document.body.innerHTML = `
    <div data-ve-root="1">
      <div data-ve-slot="1" data-ve-container="[]" data-ve-at="0" id="s0"></div>
      <div data-ve-node="[0]" id="n0"><span id="inner"></span>
        <div data-ve-column="[0,0]" id="col">
          <div data-ve-slot="1" data-ve-container="[0,0]" data-ve-at="0" id="c0"></div>
        </div>
      </div>
      <div data-ve-slot="1" data-ve-container="[]" data-ve-at="1" id="s1"></div>
      <div id="bare"></div>
    </div>`
  const n0 = document.getElementById('n0')!
  n0.getBoundingClientRect = () => rectOf(100, 100)
}

describe('drop slot resolution', () => {
  it('detects library drags from types only', () => {
    expect(isLibraryDragTypes(['application/x-ve-block'])).toBe(true)
    expect(isLibraryDragTypes(['application/x-ve-template'])).toBe(true)
    expect(isLibraryDragTypes(['Files'])).toBe(false)
    expect(isLibraryDragTypes(null)).toBe(false)
  })

  it('maps parent client coords into frame coords', () => {
    const rect = { left: 300, top: 50, width: 800, height: 600 }
    expect(clientToFrame(rect, 350, 70)).toEqual({ x: 50, y: 20 })
    expect(clientToFrame(rect, 100, 70)).toBeNull()
    expect(clientToFrame(rect, 350, 700)).toBeNull()
  })

  it('resolves a slot directly', () => {
    build()
    expect(resolveSlotFromElement(document.getElementById('s1'), 0)).toEqual({ containerPath: [], at: 1, key: '|1' })
  })

  it('resolves a block body to before/after by half', () => {
    build()
    const inner = document.getElementById('inner')
    expect(resolveSlotFromElement(inner, 120)?.at).toBe(0)
    expect(resolveSlotFromElement(inner, 180)?.at).toBe(1)
  })

  it('resolves a column to the end of its own list and the page to the end of the page', () => {
    build()
    expect(resolveSlotFromElement(document.getElementById('col'), 0)).toEqual({ containerPath: [0, 0], at: 0, key: '0.0|0' })
    expect(resolveSlotFromElement(document.getElementById('bare'), 0)).toEqual({ containerPath: [], at: 1, key: '|1' })
  })

  it('returns null outside any editor element and tolerates missing elementFromPoint', () => {
    document.body.innerHTML = '<div id="x"></div>'
    expect(resolveSlotFromElement(document.getElementById('x'), 0)).toBeNull()
    expect(resolveSlotFromElement(null, 0)).toBeNull()
    expect(resolveDropSlotInDoc({ elementFromPoint: (): null => null, querySelector: (): null => null } as unknown as Document, 1, 1)).toBeNull()
  })

  it('sends a drop outside the page body (template header/footer) to the start or end of the page', () => {
    build()
    const root = document.querySelector<HTMLElement>('[data-ve-root]')!
    root.getBoundingClientRect = () => rectOf(100, 400)
    document.body.insertAdjacentHTML('beforeend', '<footer id="foot"></footer>')
    const doc = { elementFromPoint: () => document.getElementById('foot'), querySelector: (s: string) => document.querySelector(s) } as unknown as Document
    expect(resolveDropSlotInDoc(doc, 10, 700)).toEqual({ containerPath: [], at: 1, key: '|1' })
    expect(resolveDropSlotInDoc(doc, 10, 20)).toEqual({ containerPath: [], at: 0, key: '|0' })
  })
})

describe('library drag tracking', () => {
  const dragEvent = (type: string, types: string[]) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown }
    e.dataTransfer = { types }
    return e
  }

  it('sees the card types set by a root-level (React-style) dragstart listener', async () => {
    const { trackLibraryDrag } = await import('@/views/visualEditor/dropSlot')
    document.body.innerHTML = '<div id="root"><div id="card"></div></div>'
    const state: boolean[] = []
    const off = trackLibraryDrag(document, (a) => state.push(a))
    const types: string[] = []
    // Mimics React: the card's onDragStart runs from the root container and calls setData.
    document.getElementById('root')!.addEventListener('dragstart', () => types.push('application/x-ve-block'))
    const start = new Event('dragstart', { bubbles: true }) as Event & { dataTransfer: unknown }
    start.dataTransfer = { types }
    document.getElementById('card')!.dispatchEvent(start)
    expect(state).toEqual([true])
    document.getElementById('card')!.dispatchEvent(dragEvent('dragend', types))
    expect(state).toEqual([true, false])
    off()
  })

  it('ignores non-library drags and unbinds', async () => {
    const { trackLibraryDrag } = await import('@/views/visualEditor/dropSlot')
    const state: boolean[] = []
    const off = trackLibraryDrag(document, (a) => state.push(a))
    document.body.dispatchEvent(dragEvent('dragstart', ['Files']))
    expect(state).toEqual([])
    off()
    document.body.dispatchEvent(dragEvent('drop', []))
    expect(state).toEqual([])
  })
})
