// @vitest-environment node
// Task 29g: import addresses, rendition presets, quotas, storage totals.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { downloadForImport, ImportError, importFileName, parseImportAddress } from '@/features/dam/importUrl'
import { checkQuota, kindOfMime, parseQuotas } from '@/features/dam/quota'
import { outputMime, parseRendition, renditionFileName } from '@/features/dam/renditions'
import * as store from '@/features/dam/store'
import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

describe('import addresses', () => {
  it('turns Drive links into direct downloads and refuses unsafe ones', () => {
    const drive = parseImportAddress('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')
    expect(drive.drive).toBe(true)
    expect(drive.url.href).toBe('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp')
    expect(parseImportAddress('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp').drive).toBe(true)
    expect(() => parseImportAddress('https://docs.google.com/document/d/abc/edit')).toThrow(ImportError)
    expect(() => parseImportAddress('http://example.com/a.png')).toThrow(ImportError)
    expect(() => parseImportAddress('https://localhost/a.png')).toThrow(ImportError)
    expect(() => parseImportAddress('https://10.0.0.1/a.png')).toThrow(ImportError)
    expect(() => parseImportAddress('https://user:pw@example.com/a.png')).toThrow(ImportError)
    expect(() => parseImportAddress('https://example.com:8443/a.png')).toThrow(ImportError)
  })
  it('names files safely', () => {
    expect(importFileName(null, new URL('https://example.com/img/Harbour%20Sunset.JPG'), 'image/jpeg')).toBe('Harbour Sunset.JPG')
    expect(importFileName('attachment; filename="../../etc/passwd"', new URL('https://x.com/'), 'text/plain')).not.toContain('/')
    expect(importFileName(null, new URL('https://drive.google.com/uc'), 'application/pdf')).toBe('imported.pdf')
  })
  it('downloads with checked redirects and a size cap', async () => {
    const png = new Uint8Array([1, 2, 3, 4])
    const ok: typeof fetch = async (input) => String(input).includes('start') ? new Response(null, { status: 302, headers: { location: 'https://cdn.example.com/a.png' } }) : new Response(png, { status: 200, headers: { 'content-type': 'image/png' } })
    const got = await downloadForImport(new URL('https://example.com/start'), 100, false, ok)
    expect(got).toMatchObject({ mimeType: 'image/png', filename: 'a.png' })
    expect(got.data.byteLength).toBe(4)
    const bounce: typeof fetch = async () => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/secret' } })
    await expect(downloadForImport(new URL('https://example.com/start'), 100, false, bounce)).rejects.toThrow(ImportError)
    await expect(downloadForImport(new URL('https://example.com/a'), 2, false, ok)).rejects.toMatchObject({ status: 413 })
    const html: typeof fetch = async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    await expect(downloadForImport(new URL('https://drive.google.com/uc'), 100, true, html)).rejects.toMatchObject({ status: 415 })
  })
})

describe('renditions and quotas', () => {
  it('checks presets', () => {
    expect(parseRendition({ name: 'Web', width: 1200, height: 0 }, [], null)).toMatchObject({ ok: true, value: { fit: 'scale-down', format: 'auto' } })
    expect(parseRendition({ name: 'Sq', width: 400, height: 0, fit: 'cover' }, [], null).ok).toBe(false)
    expect(parseRendition({ name: 'web', width: 10, height: 10 }, [{ id: 1, name: 'Web', width: 1, height: 1, fit: 'contain', format: 'auto' }], null).ok).toBe(false)
    expect(parseRendition({ name: '', width: 10, height: 10 }, [], null).ok).toBe(false)
    expect(outputMime('auto', 'image/gif')).toBe('image/webp')
    expect(outputMime('avif', 'image/png')).toBe('image/avif')
    expect(renditionFileName('photo.jpg', 'Web small', 'image/webp')).toBe('photo-web-small.webp')
  })
  it('checks quotas for the user that apply', () => {
    const quotas = parseQuotas([{ scope: 'role', key: 'editor', mb: 10 }, { scope: 'company', key: 'org-1', mb: 5 }])
    if (quotas.ok === false) throw new Error('bad')
    const base = { incoming: 2 * 1048576, siteLimitMb: 0, siteUsed: 0, quotas: quotas.value, roles: ['editor'], companyIds: [] as string[] }
    expect(checkQuota({ ...base, used: () => 9 * 1048576 }).ok).toBe(false)
    expect(checkQuota({ ...base, used: () => 1 * 1048576 }).ok).toBe(true)
    expect(checkQuota({ ...base, roles: ['viewer'], used: () => 99 * 1048576 }).ok).toBe(true)
    expect(checkQuota({ ...base, companyIds: ['org-1'], used: (q) => (q.scope === 'company' ? 4 * 1048576 : 0) }).ok).toBe(false)
    expect(checkQuota({ ...base, siteLimitMb: 5, siteUsed: 4 * 1048576, used: () => 0 }).ok).toBe(false)
    expect(parseQuotas([{ scope: 'role', key: 'a', mb: 0 }]).ok).toBe(false)
    expect(kindOfMime('application/pdf')).toBe('documents')
  })
})

describe('29g on a real database', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let d1: store.D1
  const now = '2027-03-10T10:00:00.000Z'
  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    const outcome = await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true, baseline: false })
    expect(outcome.errorCount).toBe(0)
    d1 = proxy.env.D1 as never as store.D1
    const ins = proxy.env.D1.prepare('INSERT INTO eg_media (id, alt, filename, mime_type, filesize, folder, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)')
    await ins.bind(1, 'a', 'a.jpg', 'image/jpeg', 3_000_000, 'photos', now).run()
    await ins.bind(2, 'b', 'b.pdf', 'application/pdf', 1_000_000, '', now).run()
    await proxy.env.D1.prepare('INSERT INTO eg_users (id, email) VALUES (7, ?1)').bind('ed@example.com').run()
    await store.logActivity(d1, 1, 'upload', '', 7, now)
    await proxy.env.D1.prepare('INSERT INTO eg_users_roles (`order`, parent_id, value) VALUES (1, 7, ?1)').bind('editor').run()
  }, 600_000)
  afterAll(async () => {
    await proxy.dispose()
  })

  it('keeps rendition presets', async () => {
    const id = await store.saveRendition(d1, null, { name: 'Web', width: 1200, height: 0, fit: 'scale-down', format: 'webp' }, now)
    await store.saveRendition(d1, id, { name: 'Web large', width: 1600, height: 0, fit: 'scale-down', format: 'webp' }, now)
    expect((await store.listRenditions(d1)).map((r) => [r.name, r.width])).toEqual([['Web large', 1600]])
    await store.deleteRendition(d1, id)
    expect(await store.listRenditions(d1)).toEqual([])
  })
  it('totals storage and counts quota use by uploader', async () => {
    const t = await store.storageTotals(d1)
    expect(t).toMatchObject({ files: 2, bytes: 4_000_000 })
    expect(t.byKind.map((k) => k.kind).sort()).toEqual(['documents', 'images'])
    expect(await store.siteBytes(d1)).toBe(4_000_000)
    expect(await store.quotaUsage(d1, { scope: 'role', key: 'editor', mb: 5 })).toBe(3_000_000)
    expect(await store.quotaUsage(d1, { scope: 'role', key: 'viewer', mb: 5 })).toBe(0)
  })
  it('round trips quotas in the settings', async () => {
    const parsed = store.parseSettings({ ...store.DEFAULT_SETTINGS, quotas: [{ scope: 'role', key: 'editor', mb: 50 }] })
    if (parsed.ok === false) throw new Error(parsed.error)
    await store.saveSettings(d1, parsed.value)
    expect((await store.getSettings(d1)).quotas).toEqual([{ scope: 'role', key: 'editor', mb: 50 }])
  })
})
