import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/admin/components/CollapsibleCard', () => ({
  CollapsibleCard: ({ children }: { children: unknown }) => h('section', {}, children as never),
}))
vi.mock('@/admin/i18n/AdminUiProvider', () => ({
  useAdminT: () => (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
}))

import { PageContentCard, splitFields } from '@/admin/views/EditForm'
import { flattenDoc, unflattenFields } from '@/admin/fields/shared'
import { VISUAL_EDITOR_SURFACES } from '@/views/visualEditor/surfaces'
import { Pages } from '@/collections/Pages'
import { PageTemplates } from '@/collections/PageTemplates'
import { SiteTemplates } from '@/collections/SiteTemplates'
import { ReusableSections } from '@/collections/ReusableSections'
import { Posts } from '@/collections/Posts'
import { Products } from '@/features/ecommerce/collections/Products'
import type { Field } from '@/engine'

const names = (list: Field[]) => list.map((f) => ('name' in f ? f.name : f.type))

describe('edit form hides visual-editor content', () => {
  const configs = { pages: Pages, 'page-templates': PageTemplates, 'site-templates': SiteTemplates, 'reusable-sections': ReusableSections, posts: Posts, products: Products }

  it.each(Object.entries(configs))('%s: the surface blocks field is not rendered in the form', (slug, collection) => {
    const blocksField = VISUAL_EDITOR_SURFACES[slug].blocksField
    const { main, settings } = splitFields(collection.fields as Field[], blocksField)
    expect(names([...main, ...settings])).not.toContain(blocksField)
  })

  it('keeps the field when no visual field is given', () => {
    expect(names(splitFields(Pages.fields as Field[]).main)).toContain('blocks')
  })

  it('links to the visual editor for a saved document', () => {
    const html = renderToStaticMarkup(h(PageContentCard, { count: 3, isNew: false, href: '/admin/visual-editor/collection/pages/2' }))
    expect(html).toContain('href="/admin/visual-editor/collection/pages/2"')
    expect(html).toContain('editor.editInVisual')
  })

  it('shows no link for a new, unsaved document', () => {
    const html = renderToStaticMarkup(h(PageContentCard, { isNew: true, href: undefined }))
    expect(html).not.toContain('<a ')
  })

  it('a save payload built from form state keeps the hidden blocks unchanged', () => {
    const blocks = [{ blockType: 'hero', id: 'a', heading: 'Hi' }]
    const doc = { title: 'Home', slug: 'home', blocks }
    const state = flattenDoc(doc, Pages.fields as Field[])
    state.title = { value: 'Renamed' }
    const payload = unflattenFields(state)
    expect(payload.title).toBe('Renamed')
    expect(payload.blocks).toEqual(blocks)
  })
})
