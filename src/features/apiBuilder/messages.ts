import { UI_STRING_SOURCE, type UiDictionary, type UiStringKey } from '@/features/uiStrings/keys'
import { interpolate, type UiStringVars } from '@/features/uiStrings/t'

/**
 * API messages, held in uiStrings. The API answers a caller in the language they asked for (Accept-Language),
 * and falls back to English. The admin builder's own validation stays English.
 */

export type ApiProblem = { key: UiStringKey; vars?: UiStringVars }

export const problem = (key: UiStringKey, vars?: UiStringVars): ApiProblem => ({ key, vars })

/** The English text of a problem. Used by the pure rules and the admin builder. */
export const englishOf = (p: ApiProblem): string => interpolate(UI_STRING_SOURCE[p.key], p.vars)

/** The text of a problem in a loaded dictionary, English when that key is missing there. */
export const textFor = (p: ApiProblem, dict?: Partial<UiDictionary> | null): string => interpolate(dict?.[p.key] || UI_STRING_SOURCE[p.key], p.vars)

/** The first tag of an Accept-Language header, or null. `fr-FR,fr;q=0.9` gives `fr-FR`. */
export function requestedLocale(acceptLanguage: string | null | undefined): string | null {
  const first = acceptLanguage?.split(',')[0]?.split(';')[0]?.trim()
  return first ? first : null
}
