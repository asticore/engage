import { repoSlug, UPSTREAM_REPO } from './versions'

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export type ApplyResult = { ok: boolean; status: 'updated' | 'up-to-date' | 'conflict' | 'not-configured' | 'refused' | 'failed'; message: string }

/**
 * One click update for a fork. The site holds a fine-grained GitHub token (Worker secret `UPDATE_GITHUB_TOKEN`) limited to
 * the fork's own repository with the smallest scope that works: Contents read and write. The token only ever calls
 * GitHub's "sync fork with upstream" endpoint on the fork named by `UPDATE_REPO`; the fork's own deploy then rebuilds the site.
 * Nothing about the site is sent. A site that deploys straight from the upstream repository has no fork to sync and is not offered this.
 */
export function oneClickConfig(fork: unknown, token: unknown, source: string = UPSTREAM_REPO): { repo: string; token: string } | null {
  const repo = repoSlug(fork)
  const secret = typeof token === 'string' ? token.trim() : ''
  if (!repo || repo.toLowerCase() === source || !secret) return null
  return { repo, token: secret }
}

export async function applyForkUpdate(config: { repo: string; token: string } | null, fetcher: Fetcher = fetch, branch = 'main'): Promise<ApplyResult> {
  if (!config) return { ok: false, status: 'not-configured', message: 'One click update needs UPDATE_REPO (your fork) and UPDATE_GITHUB_TOKEN set on this site.' }
  try {
    const res = await fetcher(`https://api.github.com/repos/${config.repo}/merge-upstream`, {
      method: 'POST',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', 'User-Agent': 'engage-update', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ branch }),
    })
    const body = (await res.json().catch((): Record<string, unknown> => ({}))) as { message?: unknown; merge_type?: unknown }
    if (res.ok) {
      return body.merge_type === 'none'
        ? { ok: true, status: 'up-to-date', message: 'Your fork already has the latest version.' }
        : { ok: true, status: 'updated', message: 'Your fork is up to date. Your deploy will rebuild the site shortly.' }
    }
    if (res.status === 409) return { ok: false, status: 'conflict', message: 'Your fork has changes that clash with the update. Sync it on GitHub and resolve the clash there.' }
    if (res.status === 401 || res.status === 403 || res.status === 404) return { ok: false, status: 'refused', message: 'GitHub refused the token. Check it is limited to your fork and has Contents read and write.' }
    return { ok: false, status: 'failed', message: typeof body.message === 'string' ? body.message.slice(0, 200) : 'GitHub could not update the fork.' }
  } catch {
    return { ok: false, status: 'failed', message: 'Could not reach GitHub.' }
  }
}

/**
 * Lean install (the Deploy button's small repository): it holds engage.config.json and a build step that downloads the
 * release named in that file. Updating, or rolling back, is committing a different `version` there; Workers Builds then redeploys.
 * Same token and repository settings as a fork (UPDATE_REPO, UPDATE_GITHUB_TOKEN); the installer sets ENGAGE_INSTALL=lean.
 */
export const isLeanInstall = (flag: unknown): boolean => flag === 'lean'

const CONFIG_PATH = 'engage.config.json'
const utf8ToB64 = (s: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
const b64ToUtf8 = (s: string): string => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)))

export async function pinInstallVersion(config: { repo: string; token: string } | null, version: string, fetcher: Fetcher = fetch, branch = 'main'): Promise<ApplyResult & { previous?: string | null }> {
  if (!config) return { ok: false, status: 'not-configured', message: 'One click update needs UPDATE_REPO (this install\'s repository) and UPDATE_GITHUB_TOKEN set on this site. Otherwise retry the latest build in the Cloudflare dashboard.' }
  const url = `https://api.github.com/repos/${config.repo}/contents/${CONFIG_PATH}`
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', 'User-Agent': 'engage-update', 'X-GitHub-Api-Version': '2022-11-28' }
  try {
    const cur = await fetcher(`${url}?ref=${encodeURIComponent(branch)}`, { headers })
    if (cur.status === 401 || cur.status === 403 || cur.status === 404) return { ok: false, status: 'refused', message: `GitHub refused the token or ${CONFIG_PATH} is missing from ${config.repo}. The token needs Contents read and write.` }
    if (!cur.ok) return { ok: false, status: 'failed', message: 'GitHub could not read the install configuration.' }
    const file = (await cur.json()) as { content: string; sha: string }
    const parsed = JSON.parse(b64ToUtf8(file.content)) as { version?: string }
    const previous = parsed.version ?? null
    if (previous === version) return { ok: true, status: 'up-to-date', message: `Already set to ${version}.`, previous }
    parsed.version = version
    const put = await fetcher(url, { method: 'PUT', headers, body: JSON.stringify({ message: `Update Engage to ${version}`, content: utf8ToB64(`${JSON.stringify(parsed, null, 2)}\n`), sha: file.sha, branch }) })
    if (put.status === 409) return { ok: false, status: 'conflict', message: 'The install repository changed while updating. Try again.' }
    if (!put.ok) return { ok: false, status: 'failed', message: 'GitHub could not save the new version.' }
    return { ok: true, status: 'updated', message: `Update to ${version} started. Cloudflare is rebuilding; reload in a few minutes.`, previous }
  } catch {
    return { ok: false, status: 'failed', message: 'Could not reach GitHub.' }
  }
}
