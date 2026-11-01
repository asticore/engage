// @vitest-environment node
// Template libraries, hub (task 2b): the Library tab's filter rules, version pinning through the address
// (a tag or commit after /tree/), and one audit entry for each library change and token check. No secret
// is ever written to the audit detail.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  getAdminContext: vi.fn(),
  audit: vi.fn(),
}))

vi.mock('@/admin/auth', () => ({ getAdminContext: h.getAdminContext }))
vi.mock('@/features/security/auditLog', () => ({ audit: h.audit, auditContext: () => ({}) }))
vi.mock('@/features/security/settings', () => ({ getSecuritySettings: vi.fn(async () => ({})) }))

import { EMPTY_LIBRARY_FILTER, filterLibraryItems, isLibraryFilterActive, libraryCategories } from '@/features/templateLibraries/filter'
import { parseLibraryUrl } from '@/features/templateLibraries/url'
import { POST as settingsPOST } from '@/app/(engage)/api/template-libraries/settings/route'
import type { LibraryItemRow } from '@/features/templateLibraries/types'

const item = (over: Partial<LibraryItemRow>): LibraryItemRow => ({
  key: 'lib-a:slug',
  libraryId: 'lib-a',
  libraryLabel: 'Acme',
  slug: 'split-hero',
  title: 'Split hero',
  kind: 'section',
  category: 'Hero',
  tags: ['hero'],
  previewUrl: '',
  ...over,
})

const items: LibraryItemRow[] = [
  item({}),
  item({ key: 'lib-a:about', slug: 'about', title: 'About us', kind: 'page', category: 'Pages', tags: ['company'] }),
  item({ key: 'lib-b:footer', libraryId: 'lib-b', libraryLabel: 'Beta', slug: 'footer-rich', title: 'Rich footer', category: 'footer', tags: ['links'] }),
  item({ key: 'lib-b:hero2', libraryId: 'lib-b', libraryLabel: 'Beta', slug: 'hero-video', title: 'Video hero', category: 'Hero', tags: ['video'] }),
]

describe('library filter', () => {
  it('shows every item when nothing is chosen', () => {
    expect(filterLibraryItems(items, EMPTY_LIBRARY_FILTER)).toHaveLength(4)
    expect(isLibraryFilterActive(EMPTY_LIBRARY_FILTER)).toBe(false)
  })

  it('narrows by library, kind and category, and combines them', () => {
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, libraryId: 'lib-b' }).map((i) => i.slug)).toEqual(['footer-rich', 'hero-video'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, kind: 'page' }).map((i) => i.slug)).toEqual(['about'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, category: 'hero' }).map((i) => i.slug)).toEqual(['split-hero', 'hero-video'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, libraryId: 'lib-b', kind: 'section', category: 'Hero' }).map((i) => i.slug)).toEqual(['hero-video'])
  })

  it('searches title, slug, category, library name and tags', () => {
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, query: '  BETA ' }).map((i) => i.slug)).toEqual(['footer-rich', 'hero-video'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, query: 'links' }).map((i) => i.slug)).toEqual(['footer-rich'])
    expect(filterLibraryItems(items, { ...EMPTY_LIBRARY_FILTER, query: 'nothing here' })).toEqual([])
  })

  it('lists each category once, A to Z, whatever the letter case', () => {
    expect(libraryCategories(items)).toEqual(['footer', 'Hero', 'Pages'])
  })
})

describe('version pinning through the address', () => {
  it('keeps a tag in the address and in the saved folder', () => {
    const pinned = parseLibraryUrl('https://github.com/acme/sections/tree/v1.2.0')
    expect(pinned.ok).toBe(true)
    if (!pinned.ok) return
    expect(pinned.value.config).toMatchObject({ owner: 'acme', repo: 'sections', branch: 'v1.2.0', path: '' })
    expect(pinned.value.url).toBe('https://github.com/acme/sections/tree/v1.2.0')
  })

  it('keeps a commit id and a folder under it', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567'
    const pinned = parseLibraryUrl(`https://github.com/acme/sections/tree/${sha}/libraries/hero`)
    expect(pinned.ok).toBe(true)
    if (!pinned.ok) return
    expect(pinned.value.config).toMatchObject({ branch: sha, path: 'libraries/hero' })
    expect(pinned.value.url).toBe(`https://github.com/acme/sections/tree/${sha}/libraries/hero`)
  })

  it('refuses a ref with spaces or dot-dot parts', () => {
    expect(parseLibraryUrl('https://github.com/acme/sections/tree/v1..2').ok).toBe(false)
  })
})

describe('audit entries for library changes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.audit.mockResolvedValue(undefined)
  })

  const adminContext = (findGlobal: unknown = { libraries: [], imports: [], token: null }) => ({
    user: { id: 3, email: 'admin@example.test' },
    isAdmin: true,
    can: () => true,
    engine: {
      findGlobal: vi.fn(async () => findGlobal),
      updateGlobal: vi.fn(async () => ({})),
    },
  })

  const post = (body: unknown) =>
    new Request('http://site.test/api/template-libraries/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it('writes an entry when a library is added, without a token in it', async () => {
    h.getAdminContext.mockResolvedValue(adminContext())
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })))
    const response = await settingsPOST(post({ action: 'add', url: 'https://github.com/acme/sections/tree/v1.2.0', label: 'Acme' }))
    expect(response.status).toBe(200)
    expect(h.audit).toHaveBeenCalledTimes(1)
    const [entry] = h.audit.mock.calls[0]
    expect(entry).toMatchObject({ action: 'settings.update', collectionSlug: 'template-libraries', actorId: 3 })
    expect(entry.detail).toContain('Template library added: Acme')
    expect(entry.detail).toContain('/tree/v1.2.0')
    vi.unstubAllGlobals()
  })

  it('writes an entry for a token change that never holds the token', async () => {
    h.getAdminContext.mockResolvedValue(adminContext())
    const secret = 'github_pat_SECRETVALUE123'
    const response = await settingsPOST(post({ action: 'token', token: secret }))
    expect(response.status).toBe(200)
    const [entry] = h.audit.mock.calls[0]
    expect(entry.detail).toBe('Template library access token saved')
    expect(JSON.stringify(h.audit.mock.calls)).not.toContain(secret)
  })

  it('writes an entry when a library is removed', async () => {
    const row = { id: 'lib-1', label: 'Acme', url: 'https://github.com/acme/sections', enabled: true }
    h.getAdminContext.mockResolvedValue(adminContext({ libraries: [row], imports: [], token: null }))
    const response = await settingsPOST(post({ action: 'remove', id: 'lib-1' }))
    expect(response.status).toBe(200)
    expect(h.audit.mock.calls[0][0].detail).toBe('Template library removed: Acme (https://github.com/acme/sections)')
  })
})
