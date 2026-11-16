// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { decidePrivateAccess, folderChain, folderVisibility, forgetPrivateCache, isPrivate } from '@/features/dam/access'
import { hashToken, isToken, newToken, parseShareInput, shareState } from '@/features/dam/share'
import * as store from '@/features/dam/store'
import { readZipEntry } from '@/features/dam/textExtract'
import { buildZip, crc32, zipNames } from '@/features/dam/zip'
import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

describe('private files', () => {
  const rules = [
    { path: 'contracts', visibility: 'private' as const },
    { path: 'contracts/public-summaries', visibility: 'public' as const },
  ]
  it('walks a folder path from the file up', () => {
    expect(folderChain('a/b/c')).toEqual(['a/b/c', 'a/b', 'a'])
    expect(folderChain('')).toEqual([])
  })
  it('lets the nearest folder rule decide', () => {
    expect(folderVisibility(rules, 'contracts/2027')).toBe('private')
    expect(folderVisibility(rules, 'contracts/public-summaries/q1')).toBe('public')
    expect(folderVisibility(rules, 'products')).toBe('public')
    expect(folderVisibility(rules, '')).toBe('public')
  })
  it('makes a file private on its own or through its folder', () => {
    expect(isPrivate('private', 'products', rules)).toBe(true)
    expect(isPrivate('public', 'contracts', rules)).toBe(true)
    expect(isPrivate('public', 'products', rules)).toBe(false)
    expect(isPrivate(null, null, [])).toBe(false)
  })
})

describe('share links', () => {
  const now = new Date('2027-03-10T12:00:00Z')
  it('makes unguessable tokens and stores only their hash', async () => {
    const a = newToken()
    expect(isToken(a)).toBe(true)
    expect(newToken()).not.toBe(a)
    expect(isToken('short')).toBe(false)
    expect(isToken(`${a}!`)).toBe(false)
    const hash = await hashToken(a)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(a)
  })
  it('knows when a link has stopped working', () => {
    const base = { expiresAt: '2027-03-11T00:00:00Z', revoked: false, maxDownloads: 0, downloads: 5 }
    expect(shareState(base, now)).toBe('ok')
    expect(shareState({ ...base, expiresAt: '2027-03-10T12:00:00Z' }, now)).toBe('expired')
    expect(shareState({ ...base, revoked: true }, now)).toBe('revoked')
    expect(shareState({ ...base, maxDownloads: 5 }, now)).toBe('used_up')
    expect(shareState({ ...base, maxDownloads: 6 }, now)).toBe('ok')
    expect(shareState({ ...base, expiresAt: null }, now)).toBe('ok')
  })
  it('validates the form that makes a link', () => {
    expect(parseShareInput({ kind: 'file', targetId: 1, days: 0 }, now).ok).toBe(false)
    expect(parseShareInput({ kind: 'file', targetId: 1, days: 366 }, now).ok).toBe(false)
    expect(parseShareInput({ kind: 'nope', targetId: 1, days: 7 }, now).ok).toBe(false)
    expect(parseShareInput({ kind: 'file', targetId: 1, days: 7, password: 'abc' }, now).ok).toBe(false)
    expect(parseShareInput({ kind: 'file', targetId: 1, days: 7, maxDownloads: -1 }, now).ok).toBe(false)
    const ok = parseShareInput({ kind: 'collection', targetId: 3, days: 7, password: 'secret1', maxDownloads: '10' }, now)
    expect(ok.ok && ok.value).toEqual({ kind: 'collection', targetId: 3, expiresAt: '2027-03-17T12:00:00.000Z', password: 'secret1', maxDownloads: 10 })
  })
})

describe('zip download', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('gives each file a safe, unique name', () => {
    expect(zipNames(['a.jpg', 'a.jpg', '../../etc/passwd', 'dir\\b.png', '.hidden', ''])).toEqual(['a.jpg', 'a (2).jpg', 'passwd', 'b.png', 'hidden', 'file'])
  })
  it('builds a zip that reads back', async () => {
    const zip = buildZip([{ name: 'one.txt', data: new TextEncoder().encode('hello') }, { name: 'two.txt', data: new TextEncoder().encode('world!') }], new Date('2027-03-10T12:00:00Z'))
    expect(new TextDecoder().decode((await readZipEntry(zip, 'one.txt'))!)).toBe('hello')
    expect(new TextDecoder().decode((await readZipEntry(zip, 'two.txt'))!)).toBe('world!')
    expect(await readZipEntry(zip, 'three.txt')).toBeNull()
  })
})

describe('private files and share links on a real database', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let d1: store.D1
  const now = '2027-03-10T10:00:00.000Z'

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    const outcome = await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true, baseline: false })
    expect(outcome.errorCount).toBe(0)
    d1 = proxy.env.D1 as never as store.D1
    const insert = proxy.env.D1.prepare('INSERT INTO eg_media (id, alt, filename, mime_type, filesize, folder, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)')
    for (const r of [[1, 'a', 'open.jpg', 'image/jpeg', 10, 'products'], [2, 'b', 'secret.pdf', 'application/pdf', 20, 'contracts/2027'], [3, 'c', 'solo.jpg', 'image/jpeg', 30, '']] as const) await insert.bind(...r, now).run()
  }, 600_000)

  afterAll(async () => {
    await proxy.dispose()
  })

  const decide = (filename: string, canReadMedia = false) => decidePrivateAccess(proxy.env.D1 as never, filename, { canReadMedia }, Date.now() + 60_000_000)

  it('serves everything while nothing is private', async () => {
    forgetPrivateCache()
    expect(await decide('open.jpg')).toEqual({ allow: true, private: false })
    expect(await decide('secret.pdf')).toEqual({ allow: true, private: false })
    expect(await decide('no-such-file.jpg')).toEqual({ allow: true, private: false })
  })
  it('hides a private file and a private folder from the public but not from staff', async () => {
    await store.setVisibility(d1, [3], 'private', now)
    await store.saveFolderRule(d1, 'contracts', 'private', now)
    forgetPrivateCache()
    expect(await decide('solo.jpg')).toEqual({ allow: false })
    expect(await decide('secret.pdf')).toEqual({ allow: false })
    expect(await decide('open.jpg')).toEqual({ allow: true, private: false })
    expect(await decide('solo.jpg', true)).toEqual({ allow: true, private: true })
    expect(await decide('secret.pdf', true)).toEqual({ allow: true, private: true })
  })
  it('opens a file again when it is made public or its folder rule is removed', async () => {
    await store.setVisibility(d1, [3], 'public', now)
    await store.saveFolderRule(d1, 'contracts', 'inherit', now)
    forgetPrivateCache()
    expect(await decide('solo.jpg')).toEqual({ allow: true, private: false })
    expect(await decide('secret.pdf')).toEqual({ allow: true, private: false })
  })
  it('keeps a share link by hash, counts downloads up to the limit and revokes', async () => {
    const hash = await hashToken(newToken())
    const id = await store.createShare(d1, { tokenHash: hash, kind: 'file', targetId: 2, expiresAt: '2027-03-17T00:00:00.000Z', passwordHash: '', maxDownloads: 2, userId: null }, now)
    const found = await store.getShareByHash(d1, hash)
    expect(found).toMatchObject({ id, kind: 'file', targetId: 2, maxDownloads: 2, downloads: 0, revoked: false, hasPassword: false })
    expect(await store.getShareByHash(d1, 'f'.repeat(64))).toBeNull()
    expect(await store.takeDownload(d1, id)).toBe(true)
    expect(await store.takeDownload(d1, id)).toBe(true)
    expect(await store.takeDownload(d1, id)).toBe(false)
    expect((await store.listShares(d1, 'file', 2))[0].downloads).toBe(2)
    const second = await store.createShare(d1, { tokenHash: await hashToken(newToken()), kind: 'collection', targetId: 9, expiresAt: null, passwordHash: 'x', maxDownloads: 0, userId: null }, now)
    await store.revokeShare(d1, second)
    expect(await store.takeDownload(d1, second)).toBe(false)
    expect((await store.mediaRows(d1, [1, 2, 99])).map((r) => r.filename).sort()).toEqual(['open.jpg', 'secret.pdf'])
  })
})
