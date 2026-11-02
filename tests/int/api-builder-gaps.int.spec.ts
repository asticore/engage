import { describe, expect, it, vi } from 'vitest'

import { buildPdf, markdownToPdfLines, winAnsi, wrapText } from '@/features/apiBuilder/pdf'
import { renderGuide } from '@/features/apiBuilder/guideResponse'
import { serveCustomEndpoint, type DeleteAudit, type EndpointEngine, type EndpointRuntimeDeps } from '@/features/apiBuilder/runtime'
import { validateEndpoint } from '@/features/apiBuilder/core'
import { textFor, englishOf, problem } from '@/features/apiBuilder/messages'
import type { ApiEndpoint } from '@/features/apiBuilder/core'
import type { EndpointStore } from '@/features/apiBuilder/store'
import type { FieldGroupDoc } from '@/fields/customFields/types'

const KEY = 'egk_' + 'a'.repeat(32)

const endpoint = (over: Partial<ApiEndpoint> = {}): ApiEndpoint => ({
  id: 1, name: 'Items', description: '', version: 'v1', slug: 'items', collection: 'products',
  fields: ['title', 'cf:size', 'cf:staffnote'], filters: [], sortable: [], defaultSort: null, defaultLimit: 20, maxLimit: 50,
  allowCreate: true, allowUpdate: true, allowDelete: true, customKinds: { 'cf:size': 'number', 'cf:staffnote': 'text' },
  requiredRole: 'any', allowedKeyIds: null, rateLimitPerMinute: 60, enabled: true, responseFormat: 'envelope', createdAt: 'x', updatedAt: 'x', ...over,
})

const store = (ep: ApiEndpoint): EndpointStore => ({
  list: async () => [ep], findByPath: async () => ep, findById: async () => ep, insert: async () => 1, update: async () => undefined,
  remove: async () => undefined, count: async () => 1, logCall: async () => undefined, pruneLog: async () => undefined, recentCalls: async () => [],
  docsSettings: async () => ({ docsPublic: false, docsToken: 't' }), setDocsPublic: async () => undefined, regenerateDocsToken: async () => 't',
})

const groups: FieldGroupDoc[] = [
  { id: 1, name: 'Sizes', fields: [{ label: 'Size', name: 'size', type: 'number' }], location: [[{ param: 'collection', operator: 'equals', value: 'products' }]] } as never,
  { id: 2, name: 'Staff only', fields: [{ label: 'Staff note', name: 'staffnote', type: 'text' }], location: [[{ param: 'collection', operator: 'equals', value: 'products' }, { param: 'userRole', operator: 'equals', value: 'admin' }]] } as never,
]

function setup(over: { roles?: string[]; ep?: Partial<ApiEndpoint>; engine?: Partial<EndpointEngine>; canDelete?: boolean; audit?: (e: DeleteAudit) => void } = {}) {
  const ep = endpoint(over.ep)
  const roles = over.roles ?? ['admin']
  const audits: DeleteAudit[] = []
  const engine: EndpointEngine = {
    auth: vi.fn(async () => ({ user: { id: 7, roles, email: 'owner@example.com' }, apiKey: { id: 5, userId: 7, name: 'k', scopes: ['products:read', 'products:write', 'pages:read', 'pages:write'] } })),
    find: vi.fn(async () => ({ docs: [], totalDocs: 0, page: 1, totalPages: 0, hasNextPage: false })),
    findByID: vi.fn(async (args) => (args.id === 1 ? { id: 1, title: 'Shoe', trashedAt: null, customFields: { size: 9, staffnote: 'x' } } : null)),
    create: vi.fn(async (args) => ({ id: 2, title: 'Hat', customFields: (args.data as { customFields?: unknown }).customFields ?? {} })),
    update: vi.fn(async (args) => ({ id: 1, title: 'Shoe', trashedAt: (args.data as { trashedAt?: unknown }).trashedAt ?? null, customFields: (args.data as { customFields?: unknown }).customFields ?? {} })),
    delete: vi.fn(async () => null),
    ...over.engine,
  }
  const deps: EndpointRuntimeDeps = {
    engine,
    store: store(ep),
    now: () => Date.parse('2026-11-02T10:00:00Z'),
    rateLimit: async () => ({ limited: false, retryAfterSeconds: 0 }),
    canDelete: () => over.canDelete ?? true,
    audit: async (entry) => { audits.push(entry); over.audit?.(entry) },
    customs: { loadGroups: async () => groups, locate: (c, _doc, r) => ({ collection: c, status: null, userRoles: [...r] }) },
    prune: false,
  }
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    serveCustomEndpoint(
      new Request(`https://site.test${path}`, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      path.split('/').filter(Boolean).slice(1),
      deps,
    )
  return { call, engine, audits }
}

describe('API builder: DELETE', () => {
  it('moves a trashable record to the trash and audits it', async () => {
    const { call, engine, audits } = setup({ ep: { collection: 'pages' } })
    const res = await call('DELETE', '/api/x/v1/items/1')
    expect(res?.status).toBe(200)
    expect(await res?.json()).toEqual({ data: { id: 1, deleted: true, mode: 'trash' } })
    expect(engine.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pages', id: 1, overrideAccess: false, data: expect.objectContaining({ trashedAt: '2026-11-02T10:00:00.000Z' }) }))
    expect(engine.delete).not.toHaveBeenCalled()
    expect(audits).toEqual([expect.objectContaining({ mode: 'trash', documentId: 1, keyId: 5, actorEmail: 'owner@example.com', endpointPath: '/api/x/v1/items' })])
  })

  it('deletes other collections for good', async () => {
    const { call, engine, audits } = setup()
    const res = await call('DELETE', '/api/x/v1/items/1')
    expect(await res?.json()).toEqual({ data: { id: 1, deleted: true, mode: 'deleted' } })
    expect(engine.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'products', id: 1, overrideAccess: false }))
    expect(audits[0]).toMatchObject({ mode: 'deleted' })
  })

  it('refuses when the owner may not delete, and writes nothing', async () => {
    const { call, engine, audits } = setup({ canDelete: false })
    const res = await call('DELETE', '/api/x/v1/items/1')
    expect(res?.status).toBe(403)
    expect(engine.delete).not.toHaveBeenCalled()
    expect(audits).toHaveLength(0)
  })

  it('is refused unless the endpoint allows it, and a missing record is 404', async () => {
    const off = setup({ ep: { allowDelete: false } })
    expect((await off.call('DELETE', '/api/x/v1/items/1'))?.status).toBe(405)
    const missing = setup()
    expect((await missing.call('DELETE', '/api/x/v1/items/9'))?.status).toBe(404)
  })

  it('reports a trash refusal from the save guard as 403, not a false success', async () => {
    const { call } = setup({ ep: { collection: 'posts' }, engine: { update: vi.fn(async () => ({ id: 1, trashedAt: null })) } })
    expect((await call('DELETE', '/api/x/v1/items/1'))?.status).toBe(403)
  })
})

describe('API builder: custom fields', () => {
  it('reads only the custom values this account may see on the record', async () => {
    const admin = setup({ roles: ['admin'] })
    const adminBody = (await (await admin.call('GET', '/api/x/v1/items/1'))?.json()) as { data: Record<string, unknown> }
    expect(adminBody.data).toEqual({ id: 1, title: 'Shoe', 'cf:size': 9, 'cf:staffnote': 'x' })
    const viewer = setup({ roles: ['viewer'] })
    const viewerBody = (await (await viewer.call('GET', '/api/x/v1/items/1'))?.json()) as { data: Record<string, unknown> }
    expect(viewerBody.data).toEqual({ id: 1, title: 'Shoe', 'cf:size': 9 })
  })

  it('writes a custom field into customFields, keeping the stored values', async () => {
    const { call, engine } = setup({ ep: { fields: ['title', 'cf:size'] } })
    const res = await call('PATCH', '/api/x/v1/items/1', { 'cf:size': 12 })
    expect(res?.status).toBe(200)
    expect(engine.update).toHaveBeenCalledWith(expect.objectContaining({ data: { customFields: { size: 12, staffnote: 'x' } } }))
  })

  it('refuses a custom field the account cannot write, before any save', async () => {
    const { call, engine } = setup({ roles: ['viewer'], ep: { fields: ['title', 'cf:staffnote'] } })
    const res = await call('POST', '/api/x/v1/items', { title: 'Hat', 'cf:staffnote': 'y' })
    expect(res?.status).toBe(403)
    expect(await res?.json()).toEqual({ errors: [{ name: 'Forbidden', message: 'The field "cf:staffnote" does not apply to this record for this account.' }] })
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('returns the save hook validation failures as 400 with each field', async () => {
    const hook = Object.assign(new Error('The following field is invalid'), { name: 'ValidationError', errors: [{ path: 'customFields.size', message: 'Size is required.' }] })
    const { call } = setup({ ep: { fields: ['title', 'cf:size'] }, engine: { create: vi.fn(async () => { throw hook }) } })
    const res = await call('POST', '/api/x/v1/items', { title: 'Hat', 'cf:size': null })
    expect(res?.status).toBe(400)
    expect(await res?.json()).toEqual({ errors: [{ name: 'ValidationError', message: 'Size is required.', path: 'customFields.size' }] })
  })

  it('refuses a custom field filter or sort in the admin rules, and records the kind', () => {
    const base = { name: 'Items', description: '', version: 'v1', slug: 'items-x', collection: 'products', fields: ['title', 'cf:size'], filters: [] as never[], sortable: [] as string[], defaultSort: null as string | null, defaultLimit: 20, maxLimit: 50, requiredRole: 'staff' }
    const ok = validateEndpoint({ ...base, fields: ['title', 'cf:size'] }, { exposable: new Set(['title', 'cf:size']), collectionFields: new Set(), customKinds: { 'cf:size': 'number' } })
    expect(ok.ok && ok.value.customKinds).toEqual({ 'cf:size': 'number' })
    expect(ok.ok && ok.value.allowDelete).toBe(false)
    const filtered = validateEndpoint({ ...base, filters: [{ field: 'cf:size', operators: ['eq'] }] }, { exposable: new Set(['title', 'cf:size']), collectionFields: new Set() })
    expect(filtered.ok).toBe(false)
  })
})

describe('API builder: PDF guide and messages', () => {
  it('builds a valid PDF file with one page object per page and a matching xref', () => {
    const lines = Array.from({ length: 120 }, (_, i) => ({ text: `Line ${i} with some words to wrap around the page edge and keep going`, style: 'body' as const }))
    const bytes = buildPdf(lines, 'Test API')
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    const pages = text.match(/\/Type \/Page /g)?.length ?? 0
    expect(pages).toBeGreaterThan(1)
    expect(text).toContain(`/Count ${pages}`)
    const xref = /startxref\n(\d+)/.exec(text)
    expect(text.slice(Number(xref?.[1]), Number(xref?.[1]) + 4)).toBe('xref')
  })

  it('turns the guide Markdown into styled lines and escapes PDF text', () => {
    const lines = markdownToPdfLines('# Title\n\n## Section\n\n| Name | Type |\n| --- | --- |\n| `title` | text |\n\n```bash\ncurl -X GET\n```\n\n- item one')
    expect(lines.find((l) => l.text === 'Title')?.style).toBe('title')
    expect(lines.find((l) => l.text === 'Section')?.style).toBe('h2')
    expect(lines.some((l) => l.text === 'title   |   text')).toBe(true)
    expect(lines.find((l) => l.text === 'curl -X GET')?.style).toBe('code')
    expect(winAnsi('Price € 5 “ok” \u4e2d')).toBe('Price EUR 5 "ok" ?')
    expect(wrapText('aaaa bbbb cccc', 9)).toEqual(['aaaa bbbb', 'cccc'])
    const pdf = renderGuide('guide.pdf', [endpoint({ enabled: true })], { baseUrl: 'https://site.test', siteName: 'Site', generatedAt: '2026-11-02' }, 'download')
    expect(pdf.headers.get('Content-Type')).toBe('application/pdf')
    expect(pdf.headers.get('Content-Disposition')).toContain('api-guide.pdf')
  })

  it('answers API messages in the caller language, English when the key has no translation', () => {
    expect(englishOf(problem('api.key.scopeNeeded', { scope: 'products:read' }))).toBe('This API key does not have the products:read scope.')
    expect(textFor(problem('api.query.sortNotAllowed', { value: '-x' }), null)).toBe('You cannot sort by "-x".')
  })
})
