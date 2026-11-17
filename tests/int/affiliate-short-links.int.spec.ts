// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import * as store from '@/features/affiliates/store'
import { AFFILIATE_LINK_STATEMENTS } from '@/migrations/20270317_240000_affiliate_links'

function setup() {
  const raw = new DatabaseSync(':memory:')
  for (const statement of AFFILIATE_LINK_STATEMENTS) raw.exec(statement)
  raw.exec("CREATE TABLE eg_products (id integer primary key, title text, slug text, _status text, deleted_at text)")
  raw.exec("INSERT INTO eg_products (id, title, slug, _status) VALUES (1, 'Mug', 'blue-mug', 'published'), (2, 'Draft', 'draft-thing', 'draft')")
  const d1: store.D1 = {
    prepare: (query) => ({
      bind: (...args) => ({
        all: async <T,>() => ({ results: raw.prepare(query).all(...(args as never[])) as T[] }),
        run: async () => {
          const r = raw.prepare(query).run(...(args as never[]))
          return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }
        },
      }),
    }),
  }
  return d1
}

describe('affiliate short links (26a)', () => {
  it('saves a code once and refuses a repeat', async () => {
    const d1 = setup()
    expect(await store.addShortLink(d1, { code: 'sam-mug', affiliateId: 5, productId: 1 }, 'now')).toBe(true)
    expect(await store.addShortLink(d1, { code: 'sam-mug', affiliateId: 6, productId: null }, 'now')).toBe(false)
  })
  it('resolves to the product page, or the home page when it has no product', async () => {
    const d1 = setup()
    await store.addShortLink(d1, { code: 'sam-mug', affiliateId: 5, productId: 1 }, 'now')
    await store.addShortLink(d1, { code: 'sam-home', affiliateId: 5, productId: null }, 'now')
    expect(await store.resolveShortLink(d1, 'sam-mug')).toEqual({ affiliateId: 5, path: '/shop/blue-mug' })
    expect(await store.resolveShortLink(d1, 'sam-home')).toEqual({ affiliateId: 5, path: '/' })
    expect(await store.resolveShortLink(d1, 'nope')).toBeNull()
  })
  it('falls back to the home page for a product that is not published', async () => {
    const d1 = setup()
    await store.addShortLink(d1, { code: 'sam-draft', affiliateId: 5, productId: 2 }, 'now')
    expect((await store.resolveShortLink(d1, 'sam-draft'))?.path).toBe('/')
  })
  it('lists and removes links', async () => {
    const d1 = setup()
    await store.addShortLink(d1, { code: 'sam-mug', affiliateId: 5, productId: 1 }, 'now')
    expect((await store.listShortLinks(d1, 5))[0]).toMatchObject({ code: 'sam-mug', productTitle: 'Mug' })
    await store.removeShortLink(d1, 'sam-mug')
    expect(await store.listShortLinks(d1)).toEqual([])
  })
})
