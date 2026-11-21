/**
 * A copy of data every public render reads (the published page list, the site settings) kept in
 * the Worker instance's memory between requests, so a warm instance skips those database reads.
 *
 * Staleness is tied to the page cache's own version number (the epoch, see epoch.ts). Publishing
 * bumps the epoch, the Worker learns the new value within about ten seconds (the same window the
 * page cache has), and a copy made under an older epoch is then thrown away. No epoch known (the
 * page cache is off, or the settings could not be read) means no memo at all.
 *
 * Only anonymous visitors get a copy: a request with a session or unlock cookie always reads
 * fresh, so an editor never sees a stale list. Copies are cloned on the way in and out so one
 * render can never change what the next one reads.
 */
type Entry = { epoch: number; value: unknown }

const store = new Map<string, Entry>()
const SESSION_COOKIE = 'engage-token'
const UNLOCK_PREFIX = 'eg_unlock_'

import { currentEpoch } from './epochState'

async function isAnonymous(): Promise<boolean> {
  try {
    const { cookies } = await import('next/headers')
    const jar = await cookies()
    return !jar.getAll().some((c) => c.name === SESSION_COOKIE || c.name.startsWith(UNLOCK_PREFIX))
  } catch {
    return false
  }
}

export async function memoByEpoch<T>(key: string, load: () => Promise<T>): Promise<T> {
  const epoch = currentEpoch()
  if (epoch === undefined || !(await isAnonymous())) return load()
  const hit = store.get(key)
  if (hit && hit.epoch === epoch) return structuredClone(hit.value) as T
  const value = await load()
  try {
    store.set(key, { epoch, value: structuredClone(value) })
  } catch {
    // Not cloneable: just do not keep it.
  }
  return value
}

export const resetRenderMemo = (): void => store.clear()
