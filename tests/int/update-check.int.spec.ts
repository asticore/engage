import { describe, expect, it } from 'vitest'

import { checkForUpdate } from '@/features/updates/check'
import { compareVersions, latestFrom, parseVersion, repoSlug, updateAvailable, updateLinks } from '@/features/updates/versions'

const reply = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status })

describe('update check', () => {
  it('parses and compares versions', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3])
    expect(parseVersion('1.2.3-beta.1')).toEqual([1, 2, 3])
    expect(parseVersion('latest')).toBeNull()
    expect(compareVersions([1, 2, 3], [1, 10, 0])).toBe(-1)
    expect(updateAvailable('1.0.0', 'v1.0.1')).toBe(true)
    expect(updateAvailable('1.0.1', '1.0.1')).toBe(false)
    expect(updateAvailable('2.0.0', '1.9.9')).toBe(false)
    expect(updateAvailable('1.0.0', 'nonsense')).toBe(false)
  })
  it('ignores drafts and prereleases, and reads package.json too', () => {
    expect(latestFrom({ tag_name: 'v1.4.0', prerelease: true })).toBeNull()
    expect(latestFrom({ tag_name: 'v1.4.0' })).toEqual({ version: '1.4.0', tag: 'v1.4.0' })
    expect(latestFrom({ version: '2.0.1' })).toEqual({ version: '2.0.1', tag: '2.0.1' })
  })
  it('builds links: upstream sites use releases, a fork syncs from upstream, bad settings are ignored', () => {
    expect(updateLinks(undefined, 'v1.1.0')).toEqual({ changelog: 'https://github.com/asticore/engage/releases/tag/v1.1.0', start: 'https://github.com/asticore/engage/releases', sameRepo: true })
    expect(updateLinks('https://github.com/acme/site', 'v1.1.0')).toMatchObject({ start: 'https://github.com/acme/site/compare/main...asticore:main', sameRepo: false })
    expect(updateLinks('javascript:alert(1)', null).sameRepo).toBe(true)
    expect(repoSlug('acme/site.git')).toBe('acme/site')
    expect(repoSlug('http://evil.example/acme/site')).toBeNull()
  })
  it('reports a newer release, falls back to package.json, and never throws', async () => {
    const newer = (async () => reply({ tag_name: 'v1.5.0' })) as never
    expect(await checkForUpdate('1.0.0', undefined, newer)).toMatchObject({ latest: '1.5.0', updateAvailable: true })
    const fallback = (async (url: string) => (url.includes('api.github.com') ? reply({}, 404) : reply({ version: '1.0.0' }))) as never
    expect(await checkForUpdate('1.0.0', undefined, fallback)).toMatchObject({ latest: '1.0.0', updateAvailable: false })
    const down = (async () => {
      throw new Error('offline')
    }) as never
    expect(await checkForUpdate('1.0.0', undefined, down)).toMatchObject({ updateAvailable: false, error: 'Could not reach GitHub.' })
  })
  it('sends nothing about the site: only the public repo address', async () => {
    const seen: string[] = []
    await checkForUpdate('1.0.0', 'acme/private-fork', (async (url: string) => {
      seen.push(url)
      return reply({ tag_name: 'v1.0.0' })
    }) as never)
    expect(seen.every((u) => /asticore\/engage/.test(u) && !u.includes('acme'))).toBe(true)
  })
})
