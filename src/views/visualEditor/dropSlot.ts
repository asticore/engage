import type { NodePath } from './treeOps'

/** Where a library card dropped at a point would insert, plus the key the canvas highlights. */
export type DropSlot = { containerPath: NodePath; at: number; key: string }

/** Native drag MIME types set by ElementLibrary.tsx / TemplateBrowser.tsx. */
export const VE_BLOCK_MIME = 'application/x-ve-block'
export const VE_TEMPLATE_MIME = 'application/x-ve-template'
export const VE_TEMPLATE_LOCKS_TYPE = 'application/x-ve-template-locks'

/** True when a drag's `types` list (the only thing readable during dragover) is a library card. */
export const isLibraryDragTypes = (types: ArrayLike<string> | null | undefined): boolean => {
  if (!types) return false
  const list = Array.from(types as ArrayLike<string>)
  return list.includes(VE_BLOCK_MIME) || list.includes(VE_TEMPLATE_MIME)
}

/**
 * Parent-viewport pointer -> iframe-document viewport coordinates (what the frame's
 * elementFromPoint expects). Null when the pointer is outside the frame.
 */
export const clientToFrame = (
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } | null => {
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null
  return { x, y }
}

const parsePath = (raw: string | undefined): NodePath | null => {
  try {
    const value: unknown = JSON.parse(raw || '[]')
    return Array.isArray(value) && value.every((n) => Number.isInteger(n)) ? (value as NodePath) : null
  } catch {
    return null
  }
}

const make = (containerPath: NodePath, at: number): DropSlot => ({ containerPath, at, key: `${containerPath.join('.')}|${at}` })

const slotOf = (slot: HTMLElement): DropSlot | null => {
  const containerPath = parsePath(slot.dataset.veContainer)
  const at = Number(slot.dataset.veAt || '0')
  return containerPath && Number.isFinite(at) ? make(containerPath, at) : null
}

const samePath = (a: NodePath, b: NodePath) => a.length === b.length && a.every((v, i) => b[i] === v)

/**
 * Resolves the insert slot for the element under the pointer: an insert slot itself, a block body
 * (the slot just before / after it by which half `y` is in), a column (end of its list) or the
 * bare page (end of the page). `y` is in the same viewport space as getBoundingClientRect().
 */
export function resolveSlotFromElement(el: Element | null, y: number): DropSlot | null {
  if (!el) return null
  const hit = el.closest('[data-ve-slot],[data-ve-node],[data-ve-column],[data-ve-root]') as HTMLElement | null
  if (!hit) return null

  if (hit.dataset.veSlot) return slotOf(hit)

  if (hit.dataset.veNode) {
    const path = parsePath(hit.dataset.veNode)
    if (!path || path.length === 0) return null
    const box = hit.getBoundingClientRect()
    const after = y > box.top + box.height / 2
    return make(path.slice(0, -1), path[path.length - 1] + (after ? 1 : 0))
  }

  const target = hit.dataset.veColumn ? parsePath(hit.dataset.veColumn) : []
  if (!target) return null
  const slots = Array.from(hit.querySelectorAll<HTMLElement>('[data-ve-slot]'))
    .map(slotOf)
    .filter((s): s is DropSlot => Boolean(s) && samePath(s!.containerPath, target))
  if (slots.length === 0) return null
  return slots.reduce((best, s) => (s.at > best.at ? s : best))
}

/** Convenience wrapper over the frame document. */
export function resolveDropSlotInDoc(doc: Document, x: number, y: number): DropSlot | null {
  return resolveSlotFromElement(doc.elementFromPoint(x, y), y)
}

/**
 * Tracks whether a library card (block or template) is being dragged, from document-level drag
 * events. `dragstart` MUST be listened to in the bubble phase: React runs the card's onDragStart
 * (which calls setData) from its root container, i.e. after a document *capture* listener, so a
 * capture listener sees an empty `dataTransfer.types` and never recognises the drag (the cause of
 * "can't drag from the Elements bar": the canvas iframe then stays pointer-active and swallows
 * dragover/drop). Returns an unbind function.
 */
export function trackLibraryDrag(doc: Document, onActive: (active: boolean) => void): () => void {
  const onStart = (e: DragEvent) => {
    // Types are readable here in every browser; the in-memory payload covers a card that registered itself first.
    if (isLibraryDragTypes(e.dataTransfer?.types) || activeDrag) onActive(true)
  }
  const onEnd = () => onActive(false)
  doc.addEventListener('dragstart', onStart)
  doc.addEventListener('dragend', onEnd, true)
  doc.addEventListener('drop', onEnd, true)
  return () => {
    doc.removeEventListener('dragstart', onStart)
    doc.removeEventListener('dragend', onEnd, true)
    doc.removeEventListener('drop', onEnd, true)
  }
}

/** What a library card carries while it is dragged. Kept in memory as well as in the DataTransfer. */
export type LibraryDragPayload =
  | { kind: 'block'; slug: string }
  | { kind: 'template'; blocksJson: string; locksJson?: string }

/**
 * The drag in flight, held in module memory. Safari hides custom types (and getData) from dragover and, in
 * some versions, drop; Firefox returns '' from getData for a drag that crossed into another document. The
 * drag source and the canvas wrapper live in the same JS realm, so they agree on the payload through here
 * instead. Cleared on dragend.
 */
let activeDrag: LibraryDragPayload | null = null

export const beginLibraryDrag = (payload: LibraryDragPayload): void => {
  activeDrag = payload
}
export const endLibraryDrag = (): void => {
  activeDrag = null
}
export const currentLibraryDrag = (): LibraryDragPayload | null => activeDrag

/**
 * Called from a card's dragstart. Writes the payload with the custom types (what the canvas wrapper
 * recognises), sets effectAllowed so Firefox and Safari offer a copy cursor, and registers the in-memory
 * copy. Firefox only starts a drag when setData was called with something during dragstart, which this does.
 */
export const startLibraryDrag = (dt: DataTransfer | null, payload: LibraryDragPayload): void => {
  beginLibraryDrag(payload)
  if (!dt) return
  try {
    if (payload.kind === 'block') dt.setData(VE_BLOCK_MIME, payload.slug)
    else {
      dt.setData(VE_TEMPLATE_MIME, payload.blocksJson)
      if (payload.locksJson) dt.setData(VE_TEMPLATE_LOCKS_TYPE, payload.locksJson)
    }
    dt.effectAllowed = 'copy'
  } catch {
    // A browser that refuses setData here still has the in-memory payload.
  }
}

/** The payload for a drop: from the DataTransfer when readable, else from the in-memory copy. */
export const readLibraryDrag = (dt: Pick<DataTransfer, 'getData'> | null | undefined): LibraryDragPayload | null => {
  let block = ''
  let template = ''
  let locks = ''
  try {
    block = dt?.getData(VE_BLOCK_MIME) ?? ''
    template = dt?.getData(VE_TEMPLATE_MIME) ?? ''
    locks = dt?.getData(VE_TEMPLATE_LOCKS_TYPE) ?? ''
  } catch {
    // Protected mode (Safari during dragover): fall through to the in-memory payload.
  }
  if (block) return { kind: 'block', slug: block }
  if (template) return { kind: 'template', blocksJson: template, locksJson: locks || undefined }
  return activeDrag
}

/**
 * Remembers the last slot a library drag hovered, so a drag that ends over the canvas without a `drop`
 * event (some Safari / Firefox cross-frame drags) can still insert there. Pure state: no DOM.
 */
export const createDragFallback = () => {
  let payload: LibraryDragPayload | null = null
  let slot: DropSlot | null = null
  let dropped = false
  return {
    start(p: LibraryDragPayload | null) {
      payload = p
      slot = null
      dropped = false
    },
    /** The last dragover result: a slot the drop would be accepted at, or null (outside, locked). */
    hover(next: DropSlot | null) {
      slot = next
    },
    /** The pointer left the canvas wrapper. */
    leave() {
      slot = null
    },
    /** A real drop event was handled. */
    drop() {
      dropped = true
    },
    /** dragend: the insert to perform, or null (it dropped normally, left the canvas, or nothing was hovered). */
    end(): { payload: LibraryDragPayload; slot: DropSlot } | null {
      const out = !dropped && payload && slot ? { payload, slot } : null
      payload = null
      slot = null
      dropped = false
      return out
    },
  }
}
