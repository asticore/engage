import { repoSlug, UPSTREAM_REPO } from './versions'

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export type ApplyResult = { ok: boolean; status: 'updated' | 'up-to-date' | 'conflict' | 'not-configured' | 'refused' | 'failed'; message: string }

/**
 * One click update for a fork. The site holds a fine-grained GitHub token (Worker secret `UPDATE_GITHUB_TOKEN`) limited to
 * the fork's own repository with the smallest scope that works: Contents read and write. The token only ever calls
 * GitHub's "sync fork with upstream" endpoint on the fork named by `UPDATE_REPO`; the fork's own deploy then rebuilds the site.
 * Nothing about the site is sent. A site that deploys straight from the upstream repository has no fork to sync and is not offered this.
 */
export function oneClickConfig(fork: unknown, token: unknown): { repo: string; token: string } | null {
  const repo = repoSlug(fork)
  const secret = typeof token === 'string' ? token.trim() : ''
  if (!repo || repo.toLowerCase() === UPSTREAM_REPO || !secret) return null
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
