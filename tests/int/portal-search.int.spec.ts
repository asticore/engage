/**
 * Account portal search: the pure screen matcher, and the search box (account
 * screens on the page, site results from /api/search-suggest, failure and
 * empty states). Network is stubbed; nothing here calls a real endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement as h } from 'react'

import { PortalSearch } from '@/features/accounts/components/PortalSearch'
import {
  matchEntries,
  matchScreens,
  normaliseQuery,
  orderNumberIn,
  parseAccountSearch,
  SETTINGS_FIELDS,
  type ScreenLink,
} from '@/features/accounts/portalSearch'
import { searchTerms } from '@/features/search/synonyms'

const LINKS: ScreenLink[] = [
  { href: '/account', label: 'Overview' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/store-credit', label: 'Store credit' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/addresses', label: 'Addresses' },
]

describe('account screen matcher', () => {
  it('needs at least two letters', () => {
    expect(matchScreens(LINKS, '')).toEqual([])
    expect(matchScreens(LINKS, 'o')).toEqual([])
    expect(matchScreens(LINKS, '  o  ')).toEqual([])
  })

  it('matches labels case-insensitively and keeps the link order', () => {
    expect(matchScreens(LINKS, 'ORD')).toEqual([{ href: '/account/orders', label: 'Orders' }])
    expect(matchScreens(LINKS, 'ad').map((l) => l.label)).toEqual(['Addresses'])
    expect(matchScreens(LINKS, 'zz')).toEqual([])
  })

  it('collapses spaces and caps long queries', () => {
    expect(normaliseQuery('  store   credit ')).toBe('store credit')
    expect(normaliseQuery('a'.repeat(200))).toHaveLength(80)
  })
})

describe('PortalSearch', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const type = (value: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value } })

  it('lists matching account screens at once, without a network call', () => {
    render(h(PortalSearch, { links: LINKS }))
    type('ord')
    expect(screen.getByRole('link', { name: 'Orders' }).getAttribute('href')).toBe('/account/orders')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a hint and does not search for one letter', () => {
    render(h(PortalSearch, { links: LINKS }))
    type('o')
    expect(screen.getByText('Type at least 2 letters to search.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds published site results, skipping any URL that is not a same-site path', async () => {
    const results: Array<Record<string, string>> = [
      { title: 'Blue mug', url: '/shop/blue-mug', type: 'product', excerpt: '' },
      { title: 'Phishing', url: 'https://evil.example/login', type: 'page', excerpt: '' },
    ]
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results }) })
    render(h(PortalSearch, { links: LINKS }))
    type('mug')
    expect(await screen.findByRole('link', { name: 'Blue mug' })).toBeTruthy()
    expect(screen.queryByText('Phishing')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith('/api/search-suggest?q=mug', expect.anything())
    expect(screen.getByText('1 found.')).toBeTruthy()
  })

  it('keeps the account list when the site search fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    render(h(PortalSearch, { links: LINKS }))
    type('ord')
    expect(await screen.findByText('Site search is unavailable right now. Your account screens are still listed.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeTruthy()
  })

  it('says nothing was found when neither source matches', async () => {
    const none: Array<Record<string, string>> = []
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ results: none }) })
    render(h(PortalSearch, { links: LINKS }))
    type('zzzz')
    expect(await screen.findByText('Nothing found for "zzzz".')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})

describe('synonyms and settings matching', () => {
  it('a synonym finds the screen it names', () => {
    expect(matchScreens(LINKS, 'purchase').map((l) => l.label)).toEqual(['Orders'])
    expect(matchScreens(LINKS, 'delivery').map((l) => l.label)).toEqual(['Addresses'])
  })

  it('a query that names a group keeps its own words too', () => {
    expect(searchTerms('2FA')).toEqual(expect.arrayContaining(['2fa', 'two-step', 'two-factor']))
    expect(searchTerms('x')).toEqual(['x'])
  })

  it('finds settings fields by label or keyword, with their own anchors', () => {
    const settings: ScreenLink[] = SETTINGS_FIELDS.map((field) => ({ href: field.href, label: field.key, keywords: field.keywords }))
    expect(matchEntries(settings, 'passkey').map((l) => l.href)).toEqual(['/account/profile#security'])
    expect(matchEntries(settings, 'change password').map((l) => l.href)).toEqual(['/account/profile#password'])
    expect(matchEntries(settings, 'default address').map((l) => l.href)).toEqual(['/account/addresses'])
    expect(matchEntries(settings, 'e-mail').map((l) => l.href)).toEqual(['/account/profile#email'])
  })

  it('reads an order number from #12, 12 or "order 12" and nothing else', () => {
    expect(orderNumberIn('#12')).toBe(12)
    expect(orderNumberIn('12')).toBe(12)
    expect(orderNumberIn('order 12')).toBe(12)
    expect(orderNumberIn('no. 7')).toBe(7)
    expect(orderNumberIn('blue mug')).toBeNull()
    expect(orderNumberIn('1 2')).toBeNull()
    expect(orderNumberIn('0')).toBeNull()
  })

  it('keeps only same-site /account links from the account search response', () => {
    const parsed = parseAccountSearch({
      orders: [
        { id: 12, label: 'n° 12', href: '/account/orders/12' },
        { id: 13, label: 'n° 13', href: 'https://evil.example/account' },
        { id: 14, label: 'n° 14', href: '//evil.example/account' },
      ],
      bookings: 'not a list',
      subscriptions: [{ id: 'x', label: 'Mug', href: '/account/subscriptions' }],
    })
    expect(parsed).toEqual({ orders: [{ id: 12, label: 'n° 12', href: '/account/orders/12' }], bookings: [], subscriptions: [] })
    expect(parseAccountSearch(null)).toEqual({ orders: [], bookings: [], subscriptions: [] })
  })
})

describe('PortalSearch with the account search', () => {
  const fetchMock = vi.fn()
  const SETTINGS: ScreenLink[] = [{ href: '/account/profile#password', label: 'Password', keywords: ['change password'] }]

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const type = (value: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value } })
  const answer = (body: unknown) => ({ ok: true, json: async () => body })

  it('shows settings fields at once, without a network call', () => {
    render(h(PortalSearch, { links: LINKS, settings: SETTINGS }))
    type('change pass')
    expect(screen.getByRole('link', { name: 'Password' }).getAttribute('href')).toBe('/account/profile#password')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('lists the customer own orders, bookings and subscriptions from the account endpoint', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('/api/account-search')
        ? answer({
            orders: [{ id: 12, label: 'n° 12', href: '/account/orders/12' }],
            bookings: [{ id: 3, label: 'Harbour walk', href: '/account/bookings' }],
            subscriptions: [{ id: 5, label: 'Coffee club', href: '/account/subscriptions' }],
          })
        : answer({ results: [] }),
    )
    render(h(PortalSearch, { links: LINKS, settings: SETTINGS, account: true }))
    type('#12')
    expect(await screen.findByRole('link', { name: 'n° 12' })).toBeTruthy()
    expect(screen.getByText('Your orders')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledWith('/api/account-search?q=%2312', expect.anything())
    type('12')
    expect(await screen.findByText('Your orders')).toBeTruthy()
  })

  it('keeps the other results when the account search fails', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith('/api/account-search') ? { ok: false, status: 401, json: async () => ({}) } : answer({ results: [] }),
    )
    render(h(PortalSearch, { links: LINKS, settings: SETTINGS, account: true }))
    type('ord')
    expect(await screen.findByText('Your orders, bookings and subscriptions could not be searched right now. The other results are still listed.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeTruthy()
  })
})
