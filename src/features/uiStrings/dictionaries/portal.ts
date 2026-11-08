import { UI_STRING_SOURCE, type UiDictionary, type UiStringKey } from '../keys'

type PortalKey = Extract<UiStringKey, `portal.${string}` | `setup.q.${string}`>

/**
 * Customer-portal strings (and the setup questionnaire's, which stay English in every locale until translated). Each locale file overrides these with its own translation;
 * any key a locale has not translated falls back to this English table.
 */
export const PORTAL_ENGLISH: Pick<UiDictionary, PortalKey> = Object.fromEntries(
  Object.entries(UI_STRING_SOURCE).filter(([key]) => key.startsWith('portal.') || key.startsWith('setup.q.')),
) as Pick<UiDictionary, PortalKey>
