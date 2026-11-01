/* @vitest-environment jsdom */
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'

/**
 * Accessibility check on the ten busiest admin lists. The real ListView renders each list on the
 * server; the test renders that output into jsdom and runs axe-core against it with the WCAG 2.0 A
 * and AA rule sets. Engine reads and collection configs are fixtures (see below), so the markup is
 * the list's own. No axe rule is switched off. Colour contrast cannot be measured in jsdom (no
 * layout or computed colours), so axe reports it as incomplete rather than as a violation; it stays
 * on the manual checklist.
 */

type FieldSpec = { name: string; type: 'text' | 'number' | 'date' | 'checkbox' | 'select'; label?: string; options?: string[] }

const COMMON: FieldSpec[] = [
  { name: 'title', type: 'text', label: 'Title' },
  { name: 'status', type: 'select', options: ['draft', 'published'] },
  { name: 'updatedAt', type: 'date', label: 'Updated' },
]

/** The ten lists: the admin's most-used collections (decided in Task 4 of remaining-work.md). */
const LISTS: { slug: string; label: string; fields: FieldSpec[]; docs: Record<string, unknown>[] }[] = [
  { slug: 'pages', label: 'Pages', fields: COMMON, docs: [] },
  { slug: 'posts', label: 'Posts', fields: COMMON, docs: [] },
  { slug: 'products', label: 'Products', fields: [...COMMON, { name: 'price', type: 'number', label: 'Price' }], docs: [] },
  { slug: 'orders', label: 'Orders', fields: [{ name: 'number', type: 'text', label: 'Number' }, { name: 'total', type: 'number', label: 'Total' }, { name: 'status', type: 'select', options: ['pending', 'paid'] }, { name: 'createdAt', type: 'date', label: 'Created' }], docs: [] },
  { slug: 'forms', label: 'Forms', fields: [{ name: 'title', type: 'text', label: 'Title' }, { name: 'updatedAt', type: 'date', label: 'Updated' }], docs: [] },
  { slug: 'form-submissions', label: 'Form submissions', fields: [{ name: 'form', type: 'text', label: 'Form' }, { name: 'createdAt', type: 'date', label: 'Received' }], docs: [] },
  { slug: 'events', label: 'Events', fields: [...COMMON, { name: 'startDate', type: 'date', label: 'Starts' }], docs: [] },
  { slug: 'event-rsvps', label: 'RSVPs', fields: [{ name: 'name', type: 'text', label: 'Name' }, { name: 'attending', type: 'checkbox', label: 'Attending' }, { name: 'createdAt', type: 'date', label: 'Received' }], docs: [] },
  { slug: 'redirects', label: 'Redirects', fields: [{ name: 'from', type: 'text', label: 'From' }, { name: 'to', type: 'text', label: 'To' }], docs: [] },
  { slug: 'coupons', label: 'Coupons', fields: [{ name: 'code', type: 'text', label: 'Code' }, { name: 'percentOff', type: 'number', label: 'Percent off' }, { name: 'updatedAt', type: 'date', label: 'Updated' }], docs: [] },
]

for (const list of LISTS) {
  list.docs = Array.from({ length: 3 }, (_, i) => {
    const row: Record<string, unknown> = { id: i + 1, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-30T10:00:00.000Z' }
    for (const field of list.fields) {
      row[field.name] = field.type === 'number' ? i * 10 + 5 : field.type === 'checkbox' ? i % 2 === 0 : field.type === 'date' ? '2026-10-30T10:00:00.000Z' : `${list.label} ${i + 1}`
    }
    if (list.fields.some((f) => f.name === 'status')) row.status = i === 0 ? 'draft' : 'published'
    return row
  })
}

const listFor = (slug: string) => LISTS.find((list) => list.slug === slug)

const engine = {
  find: vi.fn(async (args: { collection: string }) => {
    const docs = listFor(args.collection)?.docs ?? []
    return { docs, totalDocs: docs.length, totalPages: 1, page: 1, limit: 25 }
  }),
  count: vi.fn(async () => ({ totalDocs: 0 })),
  findGlobal: vi.fn(async () => ({})),
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound')
  },
  redirect: () => {
    throw new Error('redirect')
  },
}))

vi.mock('@/admin/auth', () => ({
  getAdminContext: async () => ({
    engine,
    user: { id: 1, email: 'admin@example.com', role: 'admin' },
    isAdmin: true,
    permissions: {
      collections: Object.fromEntries(LISTS.map((list) => [list.slug, { read: true, create: true, update: true, delete: true, publish: true }])),
    },
  }),
  hasAdminPanelAccess: () => true,
  getCollectionConfig: (_engine: unknown, slug: string) => {
    const list = listFor(slug)
    if (!list) return undefined
    return {
      slug,
      labels: { plural: list.label, singular: list.label },
      admin: { useAsTitle: 'title' },
      fields: list.fields.map((field) => ({ ...field, label: field.label ?? field.name })),
    }
  },
}))

vi.mock('@/features/security/settings', () => ({
  getAdminRoot: async () => 'admin',
  getSecuritySettings: async () => ({}),
}))

vi.mock('@/admin/i18n/serverUi', async () => {
  const { translateWith, UI_STRING_SOURCE } = await import('@/features/uiStrings')
  return {
    getAdminUi: async () => ({
      t: (key: never, vars?: never) => translateWith(UI_STRING_SOURCE as never, key, vars),
    }),
  }
})

const WCAG_AA = ['wcag2a', 'wcag2aa']

describe('admin lists pass axe (WCAG 2.0 A and AA)', () => {
  it.each(LISTS.map((list) => [list.slug]))('%s', async (slug) => {
    const { ListView } = await import('@/admin/views/ListView')
    // Events open on the calendar by default; the list table is the view under test.
    const element = await ListView({ collectionSlug: slug, searchParams: slug === 'events' ? { view: 'list' } : {} })
    document.body.innerHTML = renderToStaticMarkup(h('main', null, element))
    expect(document.querySelector('table.list-table')).not.toBeNull()

    const result = await axe.run(document.body, { runOnly: { type: 'tag', values: WCAG_AA } })
    // Guard against a silent run: axe must have evaluated rules against this markup.
    expect(result.passes.length).toBeGreaterThan(0)
    const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).slice(0, 3).join(' | ')}`)
    expect(summary).toEqual([])
  }, 120_000)
})
