'use client'

import { useCallback, useEffect } from 'react'

import type { UiStringKey } from '@/features/uiStrings'

export type KeyInfo = { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }

export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'delete'
  | 'clear'
  | 'moveUp'
  | 'moveDown'
  | 'help'
  | 'save'
  | 'copyStyle'
  | 'pasteStyle'
  | 'navigator'
  | 'cycleDevice'
  | 'togglePanel'
  | 'history'
  | 'finder'

/** Which actions need a selected node (the rest work with nothing selected). */
const NEEDS_SELECTION: ReadonlySet<ShortcutAction> = new Set([
  'copy',
  'cut',
  'duplicate',
  'delete',
  'clear',
  'moveUp',
  'moveDown',
  'copyStyle',
  'pasteStyle',
])

/** Maps a key press to an editor action, or null. Pure. */
export function resolveShortcut(k: KeyInfo): ShortcutAction | null {
  const mod = k.ctrl || k.meta
  const key = k.key.length === 1 ? k.key.toLowerCase() : k.key
  if (mod && !k.alt) {
    if (key === 'z') return k.shift ? 'redo' : 'undo'
    if (key === 'y' && !k.shift) return 'redo'
    if (key === 's' && !k.shift) return 'save'
    if (k.shift && key === 'c') return 'copyStyle'
    if (k.shift && key === 'v') return 'pasteStyle'
    if (k.shift && key === 'm') return 'cycleDevice'
    if (k.shift && key === 'h') return 'history'
    if (k.shift) return null
    if (key === 'c') return 'copy'
    if (key === 'x') return 'cut'
    if (key === 'v') return 'paste'
    if (key === 'd') return 'duplicate'
    if (key === 'i') return 'navigator'
    if (key === 'e') return 'finder'
    if (key === 'p') return 'togglePanel'
    return null
  }
  // "?" is Shift+/ on most layouts, so this check comes before the shift guard below.
  if (key === '?' && !k.alt) return 'help'
  if (mod || k.shift) return null
  if (k.alt) {
    if (key === 'ArrowUp') return 'moveUp'
    if (key === 'ArrowDown') return 'moveDown'
    return null
  }
  if (key === 'Delete' || key === 'Backspace') return 'delete'
  if (key === 'Escape') return 'clear'
  return null
}

/** True when typing should win over editor shortcuts (inputs, selects, contenteditable). */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el !== 'object' || !('tagName' in el)) return false
  const tag = String(el.tagName).toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(el.isContentEditable) || (typeof el.closest === 'function' && Boolean(el.closest('[contenteditable=""],[contenteditable="true"]')))
}

/** Shortcut reference shown in the top bar. `mod` is Ctrl or Cmd. */
export const SHORTCUT_LIST: { keys: string; labelKey: UiStringKey }[] = [
  { keys: 'Mod+Z', labelKey: 've.shortcut.undo' },
  { keys: 'Mod+Shift+Z or Mod+Y', labelKey: 've.shortcut.redo' },
  { keys: 'Mod+C', labelKey: 've.shortcut.copy' },
  { keys: 'Mod+X', labelKey: 've.shortcut.cut' },
  { keys: 'Mod+V', labelKey: 've.shortcut.paste' },
  { keys: 'Mod+D', labelKey: 've.shortcut.duplicate' },
  { keys: 'Delete or Backspace', labelKey: 've.shortcut.delete' },
  { keys: 'Escape', labelKey: 've.shortcut.escape' },
  { keys: 'Mod+S', labelKey: 've.shortcut.save' },
  { keys: 'Mod+Shift+C', labelKey: 've.shortcut.copyStyle' },
  { keys: 'Mod+Shift+V', labelKey: 've.shortcut.pasteStyle' },
  { keys: 'Mod+I', labelKey: 've.shortcut.navigator' },
  { keys: 'Mod+Shift+M', labelKey: 've.shortcut.device' },
  { keys: 'Mod+P', labelKey: 've.shortcut.panel' },
  { keys: 'Mod+E', labelKey: 've.shortcut.finder' },
  { keys: 'Mod+Shift+H', labelKey: 've.shortcut.history' },
  { keys: 'Alt+Up / Alt+Down', labelKey: 've.shortcut.move' },
  { keys: '/', labelKey: 've.shortcut.quickInsert' },
  { keys: 'Double-click text', labelKey: 've.shortcut.inlineEdit' },
  { keys: 'Right-click a block', labelKey: 've.shortcut.blockMenu' },
  { keys: '?', labelKey: 've.shortcut.help' },
]

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>

/**
 * One handler for both the parent document's own key presses and the ones the canvas iframe
 * forwards. Returns `handleKey` for the forwarded messages. Pass `enabled: false` while a dialog is open.
 */
export function useEditorShortcuts(options: { enabled: boolean; hasSelection: boolean; handlers: ShortcutHandlers }): {
  handleKey: (k: KeyInfo, event?: KeyboardEvent) => boolean
} {
  const { enabled, hasSelection, handlers } = options

  const handleKey = useCallback((k: KeyInfo, event?: KeyboardEvent): boolean => {
    if (!enabled) return false
    const action = resolveShortcut(k)
    if (!action) return false
    // Save works while typing in a field; every other shortcut yields to the field.
    if (action !== 'save' && event && isEditableTarget(event.target)) return false
    const run = handlers[action]
    if (!run) return false
    if (NEEDS_SELECTION.has(action) && !hasSelection) return false
    // Leave a real text selection in the page chrome (e.g. the field panel) to the browser.
    if ((action === 'copy' || action === 'cut') && event && typeof window !== 'undefined' && String(window.getSelection?.() ?? '').length > 0) return false
    event?.preventDefault()
    run()
    return true
  }, [enabled, hasSelection, handlers])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      handleKey({ key: event.key, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, alt: event.altKey }, event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey])

  return { handleKey }
}
