import { cache } from 'react'

/**
 * Reads of the same global within one page render share one database read.
 *
 * A page render asks for the site settings (and a few other globals) from many places: the layout, the
 * metadata, blocks, menus, the admin shell. Each ask was its own D1 round trip, about eight reads of the
 * site settings alone on a public page. Inside a React render, `cache()` hands every caller the same holder
 * for that request, so the first read is kept for the rest of it. Outside a render (a route handler, a
 * script, the tests) `cache()` gives a fresh holder every time, so nothing is kept and behaviour is unchanged.
 *
 * Any write through the engine clears the holder, so a request that saves something and then reads it back
 * sees the new value. Reads that pass a user or a request object are never kept (access can differ), and
 * every caller gets its own copy so one cannot change what another reads.
 */
type Holder = { reads: Map<string, Promise<unknown>> }

const holder = cache((): Holder => ({ reads: new Map() }))

export async function memoGlobalRead<T>(key: string | null, load: () => Promise<T>): Promise<T> {
  if (key === null) return load()
  const { reads } = holder()
  let pending = reads.get(key) as Promise<T> | undefined
  if (!pending) {
    pending = load()
    reads.set(key, pending)
    pending.catch((): void => {
      if (reads.get(key) === pending) reads.delete(key)
    })
  }
  const value = await pending
  return value === null || typeof value !== 'object' ? value : structuredClone(value)
}

/** Call after any engine write: the next read goes to the database again. */
export function clearGlobalMemo(): void {
  holder().reads.clear()
}
