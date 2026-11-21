import { decryptSecret, encryptSecret } from '@/utilities/secretField'

import { getMeta, setMeta } from './state'
import { repoSlug } from './versions'

/**
 * The GitHub connection that lets a site update itself with one click: the install's own repository and a fine-grained token
 * (Contents read and write on that one repository). Set once from the update popup and kept encrypted in the site's own
 * database. The Worker settings `UPDATE_REPO` and `UPDATE_GITHUB_TOKEN` still win when present.
 */
export type UpdateConnection = { repo: string; token: string }

const REPO_KEY = 'update_repo'
const TOKEN_KEY = 'update_github_token'

export async function readConnection(db: D1Database | undefined, envRepo: unknown, envToken: unknown): Promise<UpdateConnection | null> {
  const repoFromEnv = repoSlug(envRepo)
  const tokenFromEnv = typeof envToken === 'string' ? envToken.trim() : ''
  if (repoFromEnv && tokenFromEnv) return { repo: repoFromEnv, token: tokenFromEnv }
  if (!db) return null
  const repo = repoSlug(await getMeta(db, REPO_KEY).catch((): null => null))
  const stored = await getMeta(db, TOKEN_KEY).catch((): null => null)
  const token = typeof stored === 'string' ? String(decryptSecret(stored)).trim() : ''
  return repo && token ? { repo, token } : null
}

export async function saveConnection(db: D1Database, connection: UpdateConnection): Promise<void> {
  await setMeta(db, REPO_KEY, connection.repo)
  await setMeta(db, TOKEN_KEY, String(encryptSecret(connection.token)))
}

export async function clearConnection(db: D1Database): Promise<void> {
  await setMeta(db, REPO_KEY, '')
  await setMeta(db, TOKEN_KEY, '')
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>
const headers = (token: string) => ({ Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'engage-update', 'X-GitHub-Api-Version': '2022-11-28' })

/**
 * Checks a token before it is kept: with a repository given it must be able to read engage.config.json there; with none given the token's
 * only reachable repository is used (a fine-grained token limited to the install repository reaches exactly one).
 */
export async function verifyConnection(repoInput: unknown, token: string, fetcher: Fetcher = fetch): Promise<{ ok: true; repo: string } | { ok: false; message: string }> {
  const secret = token.trim()
  if (!secret) return { ok: false, message: 'Paste the GitHub token.' }
  try {
    let repo = repoSlug(repoInput)
    if (!repo) {
      const list = await fetcher('https://api.github.com/user/repos?per_page=100&sort=updated', { headers: headers(secret) })
      if (!list.ok) return { ok: false, message: 'GitHub refused the token. Check it is a fine-grained token with Contents read and write.' }
      const repos = ((await list.json().catch((): unknown[] => [])) as { full_name?: string }[]).map((r) => r.full_name).filter((n): n is string => typeof n === 'string')
      if (repos.length !== 1) return { ok: false, message: repos.length === 0 ? 'The token reaches no repository. Give it access to your install repository.' : 'The token reaches several repositories. Enter the install repository as owner/name.' }
      repo = repos[0]
    }
    const res = await fetcher(`https://api.github.com/repos/${repo}/contents/engage.config.json`, { headers: headers(secret) })
    if (res.status === 404) return { ok: false, message: `${repo} has no engage.config.json, so it is not an Engage install repository.` }
    if (!res.ok) return { ok: false, message: 'GitHub refused the token for that repository. It needs Contents read and write.' }
    return { ok: true, repo }
  } catch {
    return { ok: false, message: 'Could not reach GitHub.' }
  }
}
