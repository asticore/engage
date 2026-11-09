import { useEffect, useState, type RefObject } from 'react'

/** Elements that make a preview visible even when it has no text. */
const MEDIA_SELECTOR = 'img,svg,video,iframe,canvas,picture,input,textarea,select,button,hr,audio,object,embed'

export type PreviewMeasure = { height: number; text: string; hasMedia: boolean }

/**
 * True when a block preview shows nothing a visitor (or the editor) could see or grab: no height at all,
 * or only a sliver with neither text nor media. Pure so it can be tested without a layout engine.
 */
export const previewLooksEmpty = ({ height, text, hasMedia }: PreviewMeasure): boolean => {
  if (height < 2) return true
  return height < 16 && !text.trim() && !hasMedia
}

/** Index of the list item (`<li>`) under a pointer, for list elements; 0 when the point is on no item. */
export const listItemIndexAt = (root: Element, clientX: number, clientY: number): number => {
  const items = Array.from(root.querySelectorAll('li'))
  if (items.length === 0) return 0
  const li = items.find((item) => {
    const r = item.getBoundingClientRect()
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom
  })
  if (!li) return 0
  // Nested lists: the outermost item under the pointer counts.
  const outer = li.closest('ul,ol')
  const direct = outer ? Array.from(outer.children).filter((c) => c.tagName === 'LI') : []
  const index = direct.indexOf(li)
  return index >= 0 ? index : 0
}

/**
 * Watches a preview element and reports whether it is empty (see previewLooksEmpty). Editor-only:
 * the placeholder it drives is never rendered on the public site.
 */
export const useEmptyPreview = (ref: RefObject<HTMLElement | null>, enabled: boolean): boolean => {
  const [empty, setEmpty] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const measure = () => setEmpty(previewLooksEmpty({ height: el.offsetHeight, text: el.textContent ?? '', hasMedia: Boolean(el.querySelector(MEDIA_SELECTOR)) }))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, enabled])
  return enabled && empty
}
