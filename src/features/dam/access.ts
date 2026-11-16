/** Digital asset manager: which media files are private. Pure rules plus the one lookup the file route makes. */

export type FolderRule = { path: string; visibility: 'inherit' | 'public' | 'private' }

export const VISIBILITIES = ['public', 'private'] as const

/** Folder paths from the file's own folder up to the top. */
export function folderChain(folder: string): string[] {
  const parts = folder.split('/').filter(Boolean)
  const chain: string[] = []
  for (let i = parts.length; i > 0; i--) chain.push(parts.slice(0, i).join('/'))
  return chain
}

/** The nearest folder rule that is not "inherit" decides; no rule means public. */
export function folderVisibility(rules: FolderRule[], folder: string): 'public' | 'private' {
  const byPath = new Map(rules.map((r) => [r.path, r.visibility]))
  for (const path of folderChain(folder)) {
    const v = byPath.get(path)
    if (v === 'private' || v === 'public') return v
  }
  return 'public'
}

/** A file is private when it is marked private itself, or its folder (or a parent folder) is. */
export function isPrivate(assetVisibility: string | null | undefined, folder: string | null | undefined, rules: FolderRule[]): boolean {
  return assetVisibility === 'private' || folderVisibility(rules, folder ?? '') === 'private'
}

type D1Like = { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results: T[] }> } } }

/** How long a worker trusts "there is no private file". A file made private is guarded within this long. */
export const ANY_PRIVATE_TTL_MS = 10_000
let anyPrivate: { has: boolean } | null = null
let anyPrivateAt = 0
/** For tests, and for the route that changes visibility on the same worker. */
export function forgetPrivateCache(): void {
  anyPrivate = null
  anyPrivateAt = 0
}

export type PrivateDecision = { allow: true; private: boolean } | { allow: false }

/**
 * The file route's check. One lookup for the file and one for the folder rules. Anything that goes wrong (the asset
 * manager's tables do not exist yet, for example) means the file is public, exactly as before the feature existed.
 * Staff who can read media always get through, so the Media page can still show a private file.
 */
export async function decidePrivateAccess(d1: D1Like, filename: string, viewer: { canReadMedia: boolean }, now: number = Date.now()): Promise<PrivateDecision> {
  try {
    // Most sites have no private file at all, so one small count (kept for a few seconds in each worker) saves the lookup on every file request.
    if (!anyPrivate || now - anyPrivateAt > ANY_PRIVATE_TTL_MS) {
      const count = await d1
        .prepare("SELECT (SELECT COUNT(*) FROM eg_media_assets WHERE visibility = 'private') + (SELECT COUNT(*) FROM eg_media_folders WHERE visibility = 'private') AS n")
        .bind()
        .first<{ n: number }>()
      anyPrivate = { has: Number(count?.n ?? 0) > 0 }
      anyPrivateAt = now
    }
    if (!anyPrivate.has) return { allow: true, private: false }
    const row = await d1
      .prepare('SELECT a.visibility AS visibility, m.folder AS folder FROM eg_media m LEFT JOIN eg_media_assets a ON a.media_id = m.id WHERE m.filename = ?1 LIMIT 1')
      .bind(filename)
      .first<{ visibility: string | null; folder: string | null }>()
    if (!row) return { allow: true, private: false }
    let rules: FolderRule[] = []
    if (row.visibility !== 'private') {
      rules = (await d1.prepare("SELECT path, visibility FROM eg_media_folders WHERE visibility <> 'inherit'").bind().all<FolderRule>()).results
    }
    const priv = isPrivate(row.visibility, row.folder, rules)
    if (!priv) return { allow: true, private: false }
    return viewer.canReadMedia ? { allow: true, private: true } : { allow: false }
  } catch {
    // The asset manager's tables are missing (it was never switched on): remember that for a few seconds instead of asking every time.
    anyPrivate = { has: false }
    anyPrivateAt = now
    return { allow: true, private: false }
  }
}
