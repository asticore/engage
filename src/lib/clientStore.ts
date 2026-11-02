/**
 * Client-only values read through `useSyncExternalStore`: the server render and
 * the first client render use the server snapshot, then React re-renders with
 * the real value. This replaces "set state in an effect after mount".
 */
import { useSyncExternalStore } from 'react'

type Listener = () => void

/** A localStorage key as a store. A failed write (private browsing) keeps the value in memory for this session. */
export function createStorageStore(key: string) {
  const listeners = new Set<Listener>()
  let memory: string | null | undefined
  const notify = () => listeners.forEach((fn) => fn())
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      memory = undefined
      notify()
    }
  }
  return {
    subscribe(listener: Listener): () => void {
      if (listeners.size === 0 && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
      }
    },
    get(): string | null {
      if (memory !== undefined) return memory
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set(value: string): void {
      try {
        window.localStorage.setItem(key, value)
        memory = undefined
      } catch {
        memory = value // storage unavailable: keep the choice in memory for this session
      }
      notify()
    },
  }
}

export type StorageStore = ReturnType<typeof createStorageStore>

/** The stored string for a store (null when nothing is stored, and on the server). */
export function useStoredString(store: StorageStore): string | null {
  return useSyncExternalStore(store.subscribe, store.get, (): null => null)
}

const noopSubscribe = () => () => {}
/** false on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, (): boolean => true, (): boolean => false)
}

/** A CSS media query as a boolean (false on the server). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', listener)
      return () => mql.removeEventListener('change', listener)
    },
    (): boolean => window.matchMedia(query).matches,
    (): boolean => false,
  )
}
