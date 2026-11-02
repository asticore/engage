/**
 * Which edit pages get a results tab, and what it is called.
 *
 * Kept free of React and of server-only imports: EditView (a server component)
 * uses it to decide whether to wrap the form, and the tests use it directly.
 * The panel for each slug is chosen in EditView itself, because the A/B panel
 * is a server component and cannot live in a client module map.
 */

export type ResultsTab = {
  label: string
  /** The collection whose read permission gates the tab. */
  collection: string
  /** Shown on the disabled tab when the user may not open it. */
  deniedReason: string
}

const RESULTS_TABS: Record<string, ResultsTab> = {
  events: {
    label: 'RSVPs',
    collection: 'event-rsvps',
    deniedReason: 'Seeing RSVPs needs the Event RSVPs read permission on your role. Guest names and emails also need View guest details.',
  },
  forms: {
    label: 'Submissions',
    collection: 'form-submissions',
    deniedReason: 'Your role cannot read form submissions. Ask an administrator to give your role Read on Form Submissions.',
  },
  'ab-tests': {
    label: 'Results',
    collection: 'ab-tests',
    deniedReason: 'Your role cannot read A/B test results.',
  },
}

/** What the signed-in user may do, as the edit page knows it. */
export type ResultsAccess = {
  isAdmin: boolean
  canRead: (collection: string) => boolean
  canUpdate: (collection: string) => boolean
}

export const RESULTS_HASH = 'results'

/**
 * The results tab for an existing document, or null. Never on the create page
 * (there is nothing to report yet), never for a slug without one, and never
 * when the signed-in user cannot read the collection the tab shows.
 */
export function resultsTabFor(slug: string, id: number | undefined, access: ResultsAccess): ResultsTab | null {
  if (id === undefined) return null
  const tab = Object.prototype.hasOwnProperty.call(RESULTS_TABS, slug) ? RESULTS_TABS[slug] : undefined
  if (!tab) return null
  if (!access.canRead(tab.collection)) return null
  return tab
}

export type ResultsTabState = ResultsTab & {
  /** False when the tab is shown but the user may not open it (see `deniedReason`). */
  allowed: boolean
}

/**
 * Like resultsTabFor, but a tab the user may not open is returned marked
 * `allowed: false` instead of being dropped, so the page can show it disabled
 * with the reason rather than leaving people wondering where it went. Still null on
 * the create page and for a slug without a results tab.
 */
export function resultsTabState(slug: string, id: number | undefined, access: ResultsAccess): ResultsTabState | null {
  if (id === undefined) return null
  const tab = Object.prototype.hasOwnProperty.call(RESULTS_TABS, slug) ? RESULTS_TABS[slug] : undefined
  if (!tab) return null
  return { ...tab, allowed: resultsTabFor(slug, id, access) !== null }
}

/** `#results` selects the results tab; anything else is the edit tab. */
export function tabFromHash(hash: string): 'edit' | 'results' {
  return hash.replace(/^#/, '') === RESULTS_HASH ? 'results' : 'edit'
}
