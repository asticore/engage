import { describe, it, expect } from 'vitest'
import { checkForUpdate } from '@/features/updates/check'
import { parseManifest } from '@/features/updates/manifest'
import { isLeanInstall, oneClickConfig, pinInstallVersion } from '@/features/updates/oneClick'
import { verifyConnection } from '@/features/updates/connection'
import { isMigrationPending, pendingMigrationNames } from '@/features/updates/state'
import { updateLinks, upstreamRepo } from '@/features/updates/versions'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('configurable release source', () => {
  it('defaults to upstream and accepts a moved repo', () => {
    expect(upstreamRepo(undefined)).toBe('asticore/engage')
    expect(upstreamRepo('https://github.com/NewOrg/engage-core.git')).toBe('neworg/engage-core')
    expect(upstreamRepo('not a repo')).toBe('asticore/engage')
  })
  it('points links at the configured source', () => {
    expect(updateLinks(undefined, 'v2.0.0', 'neworg/core').changelog).toBe('https://github.com/neworg/core/releases/tag/v2.0.0')
  })
  it('does not offer one click when the install repo is the source', () => {
    expect(oneClickConfig('neworg/core', 'tok', 'neworg/core')).toBeNull()
    expect(oneClickConfig('me/site', 'tok', 'neworg/core')).toEqual({ repo: 'me/site', token: 'tok' })
  })
})

describe('checkForUpdate with a manifest', () => {
  const fetcher = (manifest: unknown) => async (url: string) => {
    if (url.includes('/releases/latest')) return json({ tag_name: 'v1.3.0' })
    if (url.endsWith('/manifest.json')) return manifest ? json(manifest) : json({}, 404)
    return json({}, 404)
  }
  it('attaches migration info to an available update', async () => {
    const r = await checkForUpdate('1.1.0', 'me/site', fetcher({ version: '1.3.0', requiresMigration: true, destructive: false, migrations: ['a'] }), new Date(0), 'asticore/engage')
    expect(r.updateAvailable).toBe(true)
    expect(r.manifest?.requiresMigration).toBe(true)
  })
  it('still works for a release with no manifest', async () => {
    const r = await checkForUpdate('1.1.0', undefined, fetcher(null))
    expect(r.updateAvailable).toBe(true)
    expect(r.manifest).toBeUndefined()
  })
  it('rejects a manifest with no version', () => {
    expect(() => parseManifest({})).toThrow()
  })
})

describe('migration pending', () => {
  it('is pending with no record, or an older record', () => {
    expect(isMigrationPending(null, '1.2.0')).toBe(true)
    expect(isMigrationPending('1.1.0', '1.2.0')).toBe(true)
    expect(isMigrationPending('1.2.0', '1.2.0')).toBe(false)
    expect(isMigrationPending('1.3.0', '1.2.0')).toBe(false)
  })
})

describe('pinInstallVersion', () => {
  const content = btoa(JSON.stringify({ version: '1.1.0' }))
  it('commits the new version and reports the previous one', async () => {
    const calls: { method: string; body?: string }[] = []
    const fetcher = async (_u: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', body: init?.body as string | undefined })
      return init?.method === 'PUT' ? json({}) : json({ content, sha: 'abc' })
    }
    const r = await pinInstallVersion({ repo: 'me/site', token: 't' }, '1.2.0', fetcher)
    expect(r).toMatchObject({ ok: true, status: 'updated', previous: '1.1.0' })
    expect(JSON.parse(atob(JSON.parse(calls[1]!.body!).content)).version).toBe('1.2.0')
  })
  it('refuses without configuration', async () => {
    expect((await pinInstallVersion(null, '1.2.0')).status).toBe('not-configured')
  })
  it('flags lean installs', () => {
    expect(isLeanInstall('lean')).toBe(true)
    expect(isLeanInstall(undefined)).toBe(false)
  })
})

describe('pendingMigrationNames', () => {
  const dbWith = (table: boolean, names: string[]) =>
    ({
      prepare: (sql: string) => ({
        first: async () => (table ? { name: 'eg_migrations' } : null),
        all: async () => ({ results: sql.includes('FROM eg_migrations') ? names.map((name) => ({ name })) : [] }),
      }),
    }) as unknown as D1Database
  it('lists only migrations not yet recorded', async () => {
    expect(await pendingMigrationNames(dbWith(true, ['a', 'b']), ['a', 'b'])).toEqual([])
    expect(await pendingMigrationNames(dbWith(true, ['a']), ['a', 'b'])).toEqual(['b'])
    expect(await pendingMigrationNames(dbWith(false, []), ['a'])).toEqual(['a'])
  })
})

describe('manifest requiresWorkerUpdate', () => {
  it('defaults to true for older manifests and honours false', () => {
    expect(parseManifest({ version: '1.2.0' }).requiresWorkerUpdate).toBe(true)
    expect(parseManifest({ version: '1.4.0', requiresWorkerUpdate: false }).requiresWorkerUpdate).toBe(false)
  })
})

describe('verifyConnection', () => {
  const ok = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status })
  it('uses the one repository a token reaches and checks engage.config.json', async () => {
    const calls: string[] = []
    const fetcher = async (url: string) => {
      calls.push(url)
      return url.includes('/user/repos') ? new Response(JSON.stringify([{ full_name: 'me/site' }])) : new Response('{}')
    }
    expect(await verifyConnection('', 'tok', fetcher)).toEqual({ ok: true, repo: 'me/site' })
    expect(calls[1]).toContain('/repos/me/site/contents/engage.config.json')
  })
  it('refuses a repository that is not an install, a refused token, and an empty token', async () => {
    expect((await verifyConnection('me/other', 'tok', ok({}, 404))).ok).toBe(false)
    expect((await verifyConnection('me/site', 'tok', ok({}, 403))).ok).toBe(false)
    expect((await verifyConnection('me/site', ' ', ok({}))).ok).toBe(false)
  })
  it('asks for the repository when the token reaches several', async () => {
    const r = await verifyConnection('', 'tok', ok([{ full_name: 'a/b' }, { full_name: 'c/d' }]))
    expect(r.ok).toBe(false)
  })
})
