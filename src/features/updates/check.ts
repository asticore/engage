import { parseManifest, type ReleaseManifest } from './manifest'
import { latestFrom, updateAvailable, updateLinks, UPSTREAM_REPO, type UpdateLinks } from './versions'

export type UpdateCheck = { current: string; latest: string | null; updateAvailable: boolean; links: UpdateLinks; checkedAt: string; error?: string; manifest?: ReleaseManifest }

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'engage-update-check' }

/**
 * Asks GitHub for the newest release of the upstream repository (falling back to package.json on its main branch when
 * there are no releases). Sends nothing about this site. Never throws: a failed check says so and reports no update.
 */
export async function checkForUpdate(current: string, fork: string | undefined, fetcher: Fetcher = fetch, now = new Date(), source: string = UPSTREAM_REPO): Promise<UpdateCheck> {
  const base = { current, checkedAt: now.toISOString() }
  try {
    let latest = null as ReturnType<typeof latestFrom>
    const release = await fetcher(`https://api.github.com/repos/${source}/releases/latest`, { headers: HEADERS })
    if (release.ok) latest = latestFrom(await release.json().catch((): null => null))
    if (!latest) {
      const pkg = await fetcher(`https://raw.githubusercontent.com/${source}/main/package.json`, { headers: { 'User-Agent': HEADERS['User-Agent'] } })
      if (pkg.ok) latest = latestFrom(await pkg.json().catch((): null => null))
    }
    if (!latest) return { ...base, latest: null, updateAvailable: false, links: updateLinks(fork, null, source), error: 'Could not read the latest version.' }
    const available = updateAvailable(current, latest.version)
    // The release's manifest.json says whether the update touches the database. Optional: older releases have none.
    const manifest = available ? await readManifest(source, latest.tag, fetcher) : undefined
    return { ...base, latest: latest.version, updateAvailable: available, links: updateLinks(fork, latest.tag, source), ...(manifest ? { manifest } : {}) }
  } catch {
    return { ...base, latest: null, updateAvailable: false, links: updateLinks(fork, null, source), error: 'Could not reach GitHub.' }
  }
}

async function readManifest(source: string, tag: string, fetcher: Fetcher): Promise<ReleaseManifest | undefined> {
  try {
    const res = await fetcher(`https://github.com/${source}/releases/download/${encodeURIComponent(tag)}/manifest.json`, { headers: { 'User-Agent': HEADERS['User-Agent'] }, redirect: 'follow' })
    return res.ok ? parseManifest(await res.json()) : undefined
  } catch {
    return undefined
  }
}
