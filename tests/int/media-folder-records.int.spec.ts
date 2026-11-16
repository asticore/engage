// @vitest-environment node
// Media folders as records (Task 29a): pure rules, then the store against a real (emulated) D1.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'

import { blankRecord, inheritedDefaults, mayUseFolder, movedPath, newFolderPath, parseFolderFields, withAltPrefix, withParents, type FolderRecord } from '@/features/media/folderRecords'
import * as store from '@/features/media/folderRecordsStore'
import { consoleLogger } from '@/localapi/logger'
import { runInternalMigrate } from '@/migrations/runInternalMigrate'

const rec = (path: string, patch: Partial<FolderRecord> = {}): FolderRecord => ({ ...blankRecord(path), ...patch })
const staff = { isAdmin: false, roles: ['editor'], companyIds: ['org-1'] }

describe('folder rules', () => {
  it('lets everyone use folders with no limit', () => {
    expect(mayUseFolder([rec('a')], 'a/b', staff)).toBe(true)
  })
  it('limits by role or company, nearest limited folder decides, admin always passes', () => {
    const recs = [rec('hr', { allowedRoles: ['viewer'] }), rec('hr/public', { allowedCompanies: ['org-1'] })]
    expect(mayUseFolder(recs, 'hr/docs', staff)).toBe(false)
    expect(mayUseFolder(recs, 'hr/public/x', staff)).toBe(true)
    expect(mayUseFolder(recs, 'hr', { ...staff, roles: ['viewer'] })).toBe(true)
    expect(mayUseFolder(recs, 'hr', { ...staff, isAdmin: true, roles: [] })).toBe(true)
  })
  it('inherits defaults from the nearest folder that sets them', () => {
    const recs = [rec('a', { altPrefix: 'Photo:', defaultLicence: 'RF' }), rec('a/b', { altPrefix: 'Chef:' })]
    expect(inheritedDefaults(recs, 'a/b/c')).toEqual({ altPrefix: 'Chef:', defaultLicence: 'RF' })
    expect(withAltPrefix('Chef:', 'harbour')).toBe('Chef: harbour')
    expect(withAltPrefix('Chef:', 'chef: harbour')).toBe('chef: harbour')
  })
  it('validates fields, names and moves', () => {
    expect(parseFolderFields({ color: 'red' }).ok).toBe(false)
    expect(parseFolderFields({ color: '#112233', allowedRoles: ['editor', 5], visibility: 'private' })).toMatchObject({ ok: true, value: { allowedRoles: ['editor'], visibility: 'private' } })
    expect(newFolderPath('a', 'b/c').ok).toBe(false)
    expect(newFolderPath('a', 'b')).toEqual({ ok: true, path: 'a/b' })
    expect(movedPath('a/b', 'a', 'x')).toBe('x/b')
    expect(movedPath('ab', 'a', 'x')).toBeNull()
    expect(withParents(['a/b/c'])).toEqual(['a', 'a/b', 'a/b/c'])
  })
})

describe('folder records on a real database', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ D1: D1Database }>>>
  let d1: store.D1
  const now = '2027-03-10T10:00:00.000Z'
  beforeAll(async () => {
    proxy = await getPlatformProxy<{ D1: D1Database }>({ persist: false })
    const outcome = await runInternalMigrate(proxy.env.D1, consoleLogger, { provisionAll: true, baseline: false })
    expect(outcome.errorCount).toBe(0)
    d1 = proxy.env.D1 as never as store.D1
    await proxy.env.D1.prepare('INSERT INTO eg_media (id, alt, filename, mime_type, filesize, folder, created_at, updated_at) VALUES (1,?1,?2,?3,?4,?5,?6,?6)').bind('x', 'x.png', 'image/png', 10, 'shots/2027', now).run()
  }, 600_000)
  afterAll(async () => {
    await proxy.dispose()
  })

  it('fills records from existing file folders and their parents', async () => {
    await store.backfillFromFiles(d1, now)
    expect((await store.listRecords(d1)).map((r) => r.path)).toEqual(['shots', 'shots/2027'])
  })
  it('creates an empty folder with parents and reports a repeat', async () => {
    expect(await store.createFolder(d1, 'brand/logos', now)).toBe(true)
    expect(await store.createFolder(d1, 'brand/logos', now)).toBe(false)
    expect((await store.listRecords(d1)).map((r) => r.path)).toContain('brand')
  })
  it('saves fields and moves the record with a rename, keeping children', async () => {
    await store.saveFields(d1, 'brand', { ...blankRecord('brand'), color: '#112233', allowedRoles: ['editor'], allowedCompanies: ['org-1'], altPrefix: 'Brand:', defaultLicence: 'Own', visibility: 'private' }, now)
    await store.remapRecords(d1, 'brand', 'identity', false, now)
    const list = await store.listRecords(d1)
    const moved = list.find((r) => r.path === 'identity')
    expect(moved).toMatchObject({ color: '#112233', allowedRoles: ['editor'], allowedCompanies: ['org-1'], altPrefix: 'Brand:', visibility: 'private' })
    expect(list.some((r) => r.path === 'identity/logos')).toBe(true)
    expect(list.some((r) => r.path.startsWith('brand'))).toBe(false)
  })
  it('deleting a folder moves its children up and drops its record', async () => {
    await store.remapRecords(d1, 'identity', 'identity'.includes('/') ? '' : '', true, now)
    const list = (await store.listRecords(d1)).map((r) => r.path)
    expect(list).not.toContain('identity')
    expect(list).toContain('logos')
  })
  it('checks a user against the records', async () => {
    await store.saveFields(d1, 'logos', { ...blankRecord('logos'), allowedRoles: ['viewer'] }, now)
    expect(await store.userMayUse(d1, { id: 99, roles: ['editor'] }, false, 'logos')).toBe(false)
    expect(await store.userMayUse(d1, { id: 99, roles: ['viewer'] }, false, 'logos')).toBe(true)
    expect(await store.userMayUse(d1, { id: 1, roles: [] }, true, 'logos')).toBe(true)
  })
})
