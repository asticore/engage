import { createContext, type MutableRefObject } from 'react'

import { VERSIONS_HEADER, type ConnectionVersions } from '../versionHeaders'

/**
 * Client side of the stale-tab check on the Tracking and Google connection
 * screens (Task 9c). The screen keeps the `updatedAt` values it loaded, sends them
 * with each write, and keeps the newer values each answer carries, so its own
 * saves never conflict with each other.
 */

export type VersionRef = MutableRefObject<ConnectionVersions>

export const ConnectionVersionsContext = createContext<VersionRef | null>(null)

/** The header for one request: every version this screen holds. */
export function versionHeaders(ref: VersionRef | null): Record<string, string> {
  if (!ref) return {}
  const known = Object.fromEntries(Object.entries(ref.current).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  return { [VERSIONS_HEADER]: JSON.stringify(known) }
}

/** Keeps the versions an answer carries (a save, or a read that recorded an error). */
export function rememberVersions(ref: VersionRef | null, body: unknown): void {
  if (!ref || !body || typeof body !== 'object') return
  const versions = (body as { versions?: unknown }).versions
  if (!versions || typeof versions !== 'object') return
  ref.current = { ...ref.current, ...(versions as ConnectionVersions) }
}
