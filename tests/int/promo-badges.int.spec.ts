// @vitest-environment node
import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ShopExtraSettings } from '@/globals/ShopExtraSettings'
import { PromoBadges } from '@/components/PromoBadges'
import { badgesFor, loadPromoBadges, normalisePromoBadges, promoBadgesFrom, MAX_BADGES_PER_CARD } from '@/features/ecommerce/lib/promoBadges'

const now = new Date('2026-11-09T00:00:00Z')

describe('promo badges: cleaning the stored rows', () => {
  it('drops empty, switched-off and non-object rows, and falls back on unknown picks', () => {
    const rows = normalisePromoBadges([
      { text: 'Sale', appliesTo: 'sale', position: 'bottom-right', effect: 'shine', style: 'outline', shape: 'pill', colour: '#123456' },
      { text: '' },
      { text: 'Off', enabled: false },
      null,
      { text: 'Odd', colour: 'red; background:url(x)', position: 'middle', effect: 'spin', icon: 'nope', appliesTo: 'zzz' },
      { icon: 'star' },
    ])
    expect(rows.map((r) => r.text)).toEqual(['Sale', 'Odd', ''])
    expect(rows[0]).toMatchObject({ position: 'bottom-right', effect: 'shine', style: 'outline', shape: 'pill', colour: '#123456' })
    expect(rows[1]).toMatchObject({ colour: '#b3261e', position: 'top-left', effect: 'none', icon: null, appliesTo: 'all' })
    expect(rows[2].icon).toBe('star')
  })

  it('reads nothing from a missing value and respects the switch', () => {
    expect(normalisePromoBadges(undefined)).toEqual([])
    expect(promoBadgesFrom(null)).toEqual([])
    expect(promoBadgesFrom({ promoBadgesEnabled: false, promoBadges: [{ text: 'Sale' }] })).toEqual([])
    expect(promoBadgesFrom({ promoBadges: [{ text: 'Sale' }] })).toHaveLength(1)
  })

  it('loadPromoBadges never throws', async () => {
    expect(await loadPromoBadges({ findGlobal: async () => { throw new Error('x') } })).toEqual([])
    expect(await loadPromoBadges({ findGlobal: async () => ({ promoBadges: [{ text: 'New', appliesTo: 'new' }] }) })).toHaveLength(1)
  })
})

describe('promo badges: rules', () => {
  const badges = normalisePromoBadges([
    { text: 'Sale', appliesTo: 'sale', priority: 5 },
    { text: 'New', appliesTo: 'new', newDays: 10, priority: 1 },
    { text: 'Best', appliesTo: 'tag', tag: 'Best Seller' },
    { text: 'Prints', appliesTo: 'category', category: 'prints' },
    { text: 'Picked', appliesTo: 'products', productSlugs: 'linen-tote, silk-scarf' },
    { text: 'Gone', appliesTo: 'soldOut' },
    { text: 'Later', appliesTo: 'all', startsAt: '2027-01-01T00:00:00Z' },
    { text: 'Ended', appliesTo: 'all', endsAt: '2026-01-01T00:00:00Z' },
  ])
  const texts = (p: Parameters<typeof badgesFor>[1]) => badgesFor(badges, p, now).map((b) => b.text)

  it('matches sale, new, sold out, tag, category and chosen products', () => {
    expect(texts({ onSale: true })).toEqual(['Sale'])
    expect(texts({ createdAt: '2026-11-05T00:00:00Z' })).toEqual(['New'])
    expect(texts({ createdAt: '2026-09-01T00:00:00Z' })).toEqual([])
    expect(texts({ soldOut: true })).toEqual(['Gone'])
    expect(texts({ tags: [{ slug: 'best-seller' }] })).toEqual(['Best'])
    expect(texts({ tags: [1, 2] })).toEqual([])
    expect(texts({ category: 'prints' })).toEqual(['Prints'])
    expect(texts({ slug: 'silk-scarf' })).toEqual(['Picked'])
  })

  it('ignores badges outside their dates, orders by priority and caps the count', () => {
    const all = texts({ onSale: true, createdAt: '2026-11-08T00:00:00Z', category: 'prints', slug: 'linen-tote', soldOut: true })
    expect(all).toHaveLength(MAX_BADGES_PER_CARD)
    expect(all[0]).toBe('New')
    expect(all).not.toContain('Later')
    expect(all).not.toContain('Ended')
  })
})

describe('promo badges: rendering and config', () => {
  it('renders each badge in its corner with escaped text, icon and effect class', () => {
    const list = normalisePromoBadges([{ text: '<b>Hi</b>', icon: 'star', position: 'top-right', effect: 'pulse', colour: '#ff0000' }])
    const html = renderToStaticMarkup(React.createElement(PromoBadges, { badges: list }))
    expect(html).toContain('eg-badges--top-right')
    expect(html).toContain('eg-badge--fx-pulse')
    expect(html).toContain('--eg-badge-bg:#ff0000')
    expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;')
    expect(html).toContain('<svg')
    expect(renderToStaticMarkup(React.createElement(PromoBadges, { badges: [] }))).toBe('')
  })

  it('declares the switch and the array on the shop-extra-settings global with picker fields', () => {
    const flat = JSON.stringify(ShopExtraSettings.fields, (_k, v) => (typeof v === 'function' ? 'fn' : v))
    expect(flat).toContain('promoBadgesEnabled')
    expect(flat).toContain('promoBadges')
    expect(flat).toContain('BadgeIconField#BadgeIconField')
    expect(flat).toContain('ColorPickerField#ColorPickerField')
  })
})
