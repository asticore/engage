/**
 * Optimistic overwrite check for the visual editor's save. The editor remembers the document's
 * `updatedAt` from when it loaded (and from each of its own saves); before a PATCH it asks the server
 * for the current value. A newer server value means someone else saved in between.
 */
export function savedByAnotherSince(serverUpdatedAt: unknown, loadedUpdatedAt: unknown): boolean {
  if (typeof serverUpdatedAt !== 'string' || typeof loadedUpdatedAt !== 'string') return false
  const server = Date.parse(serverUpdatedAt)
  const loaded = Date.parse(loadedUpdatedAt)
  if (Number.isNaN(server) || Number.isNaN(loaded)) return false
  return server > loaded
}

/** The `updatedAt` of a save response: Payload returns the saved document as `doc` (collections) or `result` (globals). */
export function updatedAtFromSave(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const { doc, result } = body as { doc?: { updatedAt?: unknown }; result?: { updatedAt?: unknown } }
  const value = doc?.updatedAt ?? result?.updatedAt
  return typeof value === 'string' ? value : undefined
}
