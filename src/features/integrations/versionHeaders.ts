/**
 * Stale-tab check for the Tracking and Google connection screens (Task 9c). The
 * page sends, in one header, the `updatedAt` it loaded for each global it may
 * write. A route refuses with 409 when a global it writes has moved on since.
 * Shared by the server routes and the screens, so the names live in one place.
 * No imports on purpose.
 */

/** JSON object: global slug to the `updatedAt` the page loaded. */
export const VERSIONS_HEADER = 'X-Expected-Versions'

/** Same wording as the Settings save refusal (Task 9a). */
export const CONFLICT_MESSAGE =
  'These settings changed in another tab or by another admin, so this save was not made. Reload the page to see the latest values, then make your change again.'

/** Global slug to its `updatedAt` (null when the global has none). */
export type ConnectionVersions = Record<string, string | null>
