/**
 * Concurrent callers of a read share one promise instead of each running their own query.
 * The per-isolate caches fill only after the first read finishes, so several reads started
 * together (middleware, layout and page all asking for the same settings) used to each hit D1.
 */
export function shareInflight<T>(read: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null
  return () => {
    if (!pending) {
      pending = read().finally(() => {
        pending = null
      })
    }
    return pending
  }
}
