/**
 * The effect a generated theme suggested (Theming > Presets > Styles you like). It is only remembered in this browser;
 * nothing is applied until the owner presses Apply on a block in the visual editor's Effects picker, so effects stay
 * chosen from the picker.
 */
import { effectById } from './catalog'

const KEY = 'engage-suggested-effect'

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Remembers a suggestion (or clears it with null). */
export function rememberSuggestedEffect(id: string | null): void {
  try {
    const s = storage()
    if (!s) return
    if (id && effectById(id)) s.setItem(KEY, id)
    else s.removeItem(KEY)
  } catch {
    // Storage can be blocked; the suggestion is a convenience only.
  }
}

/** The remembered suggestion, when it is still an effect in the catalogue. */
export function readSuggestedEffect(): string | null {
  try {
    const id = storage()?.getItem(KEY) ?? null
    return id && effectById(id) ? id : null
  } catch {
    return null
  }
}
