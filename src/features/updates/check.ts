import { latestFrom, updateAvailable, updateLinks, UPSTREAM_REPO, type UpdateLinks } from './versions'

export type UpdateCheck = { current: string; latest: string | null; updateAvailable: boolean; links: UpdateLinks; checkedAt: string; error?: string }

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'engage-update-check' }

/**
 * Asks GitHub for the newest release of the upstream repository (falling back to package.json on its main branch when
 * there are no releases). Sends nothing about this site. Never throws: a failed check says so and reports no update.
 */
export async function checkForUpdate(current: string, fork: string | undefined, fetcher: Fetcher = fetch, now = new Date()): Promise<UpdateCheck> {
  const base = { current, checkedAt: now.toISOString() }
  try {
    let latest = null as ReturnType<typeof latestFrom>
    const release = await fetcher(`https://api.github.com/repos/${UPSTREAM_REPO}/releases/latest`, { headers: HEADERS })
    if (release.ok) latest = latestFrom(await release.json().catch((): null => null))
    if (!latest) {
      const pkg = await fetcher(`https://raw.githubusercontent.com/${UPSTREAM_REPO}/main/package.json`, { headers: { 'User-Agent': HEADERS['User-Agent'] } })
      if (pkg.ok) latest = latestFrom(await pkg.json().catch((): null => null))
    }
    if (!latest) return { ...base, latest: null, updateAvailable: false, links: updateLinks(fork, null), error: 'Could not read the latest version.' }
    return { ...base, latest: latest.version, updateAvailable: updateAvailable(current, latest.version), links: updateLinks(fork, latest.tag) }
  } catch {
    return { ...base, latest: null, updateAvailable: false, links: updateLinks(fork, null), error: 'Could not reach GitHub.' }
  }
}
