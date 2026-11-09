import referencesFile from '../../../reference/references.json'

/**
 * The reference file every install ships with (reference/references.json): the shared sources the portal
 * follows. It is bundled, so it works on a fresh install with no setup and no network.
 */

export type ReferenceSource = {
  id: string
  name: string
  type: string
  url: string
  branch: string
  version?: string
  commit?: string
  vendored?: string
  cdn?: string
  usedFor: string
  license?: string
}

export type ReferenceFile = { format: 'engage-references'; version: number; sources: ReferenceSource[] }

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Validates the file shape; drops sources that are not an https GitHub address. Never throws. */
export function parseReferences(raw: unknown): ReferenceFile {
  const doc = (raw && typeof raw === 'object' ? raw : {}) as { version?: unknown; sources?: unknown }
  const list = Array.isArray(doc.sources) ? doc.sources : []
  const sources: ReferenceSource[] = []
  for (const item of list) {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const id = text(row.id)
    const url = text(row.url)
    if (!/^[a-z0-9-]{1,40}$/.test(id) || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url)) continue
    sources.push({
      id,
      name: text(row.name) || id,
      type: text(row.type),
      url,
      branch: text(row.branch) || 'main',
      version: text(row.version) || undefined,
      commit: text(row.commit) || undefined,
      vendored: text(row.vendored) || undefined,
      cdn: text(row.cdn) || undefined,
      usedFor: text(row.usedFor),
      license: text(row.license) || undefined,
    })
  }
  return { format: 'engage-references', version: Number(doc.version) || 1, sources }
}

export function loadReferences(): ReferenceFile {
  return parseReferences(referencesFile)
}

export function referenceById(id: string): ReferenceSource | null {
  return loadReferences().sources.find((source) => source.id === id) ?? null
}

export type ReferenceUpdate = { id: string; name: string; current: string | null; latest: string | null; outdated: boolean; error: string | null }

type FetchLike = (url: string, init: { signal: AbortSignal; headers: Record<string, string>; redirect: 'error' }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>

/**
 * Asks GitHub for the newest commit of each source. Fails safe: a source GitHub cannot answer for is reported with an
 * error and `outdated: false`; nothing throws and nothing is changed. Used by the update check, never on a page load.
 */
export async function checkReferenceUpdates(
  file: ReferenceFile = loadReferences(),
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 4000,
): Promise<ReferenceUpdate[]> {
  return Promise.all(
    file.sources.map(async (source): Promise<ReferenceUpdate> => {
      const base = { id: source.id, name: source.name, current: source.commit ?? null }
      const m = source.url.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)$/)
      if (!m) return { ...base, latest: null, outdated: false, error: 'Not a GitHub address.' }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetchImpl(`https://api.github.com/repos/${m[1]}/${m[2]}/commits/${encodeURIComponent(source.branch)}`, {
          signal: controller.signal,
          headers: { accept: 'application/vnd.github+json', 'user-agent': 'engage-references' },
          redirect: 'error',
        })
        if (!res.ok) return { ...base, latest: null, outdated: false, error: 'GitHub could not be reached.' }
        const body = (await res.json()) as { sha?: unknown }
        const latest = typeof body.sha === 'string' && /^[0-9a-f]{40}$/.test(body.sha) ? body.sha : null
        return { ...base, latest, outdated: Boolean(latest && source.commit && latest !== source.commit), error: latest ? null : 'GitHub sent no version.' }
      } catch {
        return { ...base, latest: null, outdated: false, error: 'GitHub could not be reached.' }
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}
