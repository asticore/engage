/**
 * Update check: pure helpers. The portal compares its own version (package.json) with the latest release of the
 * upstream repository and tells super admins when a newer one exists. Nothing about the site is sent to GitHub.
 */

export const UPSTREAM_REPO = 'asticore/engage'

/** The release source. Set UPDATE_SOURCE ("owner/name" or a github.com URL) to move the project; default is the upstream above. */
export function upstreamRepo(setting?: unknown): string {
  return repoSlug(setting)?.toLowerCase() ?? UPSTREAM_REPO
}

export type Version = [number, number, number]

/** `v1.2.3`, `1.2.3` or `1.2.3-beta` to numbers. Anything else is not a version. */
export function parseVersion(text: unknown): Version | null {
  if (typeof text !== 'string') return null
  const m = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:[-+].*)?$/.exec(text.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function compareVersions(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  return 0
}

/** True only when both are real versions and `latest` is newer. A prerelease of the same number does not count as newer. */
export function updateAvailable(current: unknown, latest: unknown): boolean {
  const a = parseVersion(current)
  const b = parseVersion(latest)
  return Boolean(a && b && compareVersions(a, b) < 0)
}

/** `owner/name` from a GitHub address or the short form. Anything else is null, so a bad setting never builds a link. */
export function repoSlug(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const m = /^(?:https:\/\/github\.com\/)?([\w.-]{1,39})\/([\w.-]{1,100}?)(?:\.git)?\/?$/.exec(input.trim())
  return m ? `${m[1]}/${m[2]}` : null
}

export type UpdateLinks = { changelog: string; start: string; sameRepo: boolean }

/**
 * Where the buttons go. A site that deploys from the upstream repository updates by redeploying, so Start opens the
 * releases page. A fork (set with UPDATE_REPO) updates by syncing the fork with upstream: Start opens GitHub's compare page
 * that brings the fork's main up to date, and a deploy from the fork follows.
 */
export function updateLinks(fork: unknown, latestTag: string | null, source: string = UPSTREAM_REPO): UpdateLinks {
  const own = repoSlug(fork)
  const changelog = latestTag ? `https://github.com/${source}/releases/tag/${encodeURIComponent(latestTag)}` : `https://github.com/${source}/releases`
  if (own && own.toLowerCase() !== source) {
    return { changelog, start: `https://github.com/${own}/compare/main...${source.split('/')[0]}:main`, sameRepo: false }
  }
  return { changelog, start: `https://github.com/${source}/releases`, sameRepo: true }
}

/** The latest version from a GitHub releases/latest answer, or from a package.json, whichever it is. */
export function latestFrom(body: unknown): { version: string; tag: string } | null {
  const b = (body && typeof body === 'object' ? body : {}) as { tag_name?: unknown; version?: unknown; draft?: unknown; prerelease?: unknown }
  if (b.draft === true || b.prerelease === true) return null
  const raw = typeof b.tag_name === 'string' ? b.tag_name : typeof b.version === 'string' ? b.version : ''
  const parsed = parseVersion(raw)
  return parsed ? { version: parsed.join('.'), tag: raw } : null
}
