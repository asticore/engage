/** Digital asset manager: stored previous versions of a file. Pure helpers. */

export type Version = { id: number; mediaId: number; r2Key: string; filename: string; mimeType: string; filesize: number; width: number | null; height: number | null; contentHash: string; note: string; createdAt: string }

/**
 * Where a previous version is kept in storage. The slash keeps it out of the public file route (which refuses names with a
 * slash), exactly like the kept originals.
 */
export function versionKey(mediaId: number, stamp: string, filename: string): string {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)
  return `versions/${mediaId}/${stamp.replace(/[^0-9]/g, '').slice(0, 17)}-${safe}`
}

/** The versions to remove so only the newest `keep` remain. `versions` may be in any order. */
export function versionsToPrune<T extends { id: number; createdAt: string }>(versions: T[], keep: number): T[] {
  const newestFirst = [...versions].sort((a, b) => (a.createdAt === b.createdAt ? b.id - a.id : b.createdAt.localeCompare(a.createdAt)))
  return newestFirst.slice(Math.max(0, keep))
}

/** Rewrites every reference to `from` found at `paths` in a stored document to `to`. Returns the changed top-level keys with their new values. */
export function replaceAtPaths(doc: Record<string, unknown>, paths: string[], from: number, to: number): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>
  const changedKeys = new Set<string>()
  for (const path of paths) {
    const parts = path.split('.')
    if (parts.length === 0 || parts[0] === '') continue
    let node: unknown = clone
    for (let i = 0; i < parts.length - 1; i++) node = (node as Record<string, unknown>)?.[parts[i]]
    const last = parts[parts.length - 1]
    if (node === null || typeof node !== 'object') continue
    const holder = node as Record<string, unknown>
    const current = holder[last]
    const isString = typeof current === 'string' || (current && typeof current === 'object' && typeof (current as { id?: unknown }).id === 'string')
    if (current === undefined) continue
    holder[last] = isString ? String(to) : to
    changedKeys.add(parts[0])
  }
  void from
  const out: Record<string, unknown> = {}
  for (const key of changedKeys) out[key] = clone[key]
  return out
}
