'use client'

import { useEffect, type RefObject } from 'react'

const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Keeps keyboard focus inside a dialog while it is active.
 *
 * - On activation, remembers the focused element and moves focus to the first
 *   `[data-autofocus]` element inside the container, else the first tabbable
 *   one, else the container itself (which needs tabindex="-1").
 * - Tab and Shift+Tab wrap around inside the container.
 * - On deactivation (or unmount), focus returns to the remembered element if
 *   it is still in the page.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const container = ref.current
    if (!active || !container) return

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const tabbables = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>(TABBABLE))

    const initial = container.querySelector<HTMLElement>('[data-autofocus]') ?? tabbables()[0] ?? container
    initial.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = tabbables()
      if (items.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (event.shiftKey) {
        if (current === first || !container.contains(current)) {
          event.preventDefault()
          last.focus()
        }
      } else if (current === last || !container.contains(current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous && previous.isConnected) previous.focus()
    }
  }, [ref, active])
}
