'use client'

import Link from 'next/link'
import React, { useEffect, useId, useState } from 'react'

import { parseSuggestions, type SuggestItem } from '@/components/blocks/elements/searchSuggestLogic'

import {
  matchEntries,
  normaliseQuery,
  parseAccountSearch,
  PORTAL_SEARCH_MIN_CHARS,
  type AccountItem,
  type AccountSearchResults,
  type ScreenLink,
} from '../portalSearch'
import { usePortalText } from './PortalText'

/** The settled answer for one query. `value` is null when the request failed. Answers for an older query are ignored. */
type Settled<T> = { query: string; value: T | null }

const SITE_DEBOUNCE_MS = 200
const SITE_MAX_RESULTS = 8

const siteUrl = (query: string) => `/api/search-suggest?q=${encodeURIComponent(query)}`
const accountUrl = (query: string) => `/api/account-search?q=${encodeURIComponent(query)}`
const parseSite = (json: unknown): SuggestItem[] => parseSuggestions(json, SITE_MAX_RESULTS)

/**
 * Asks one JSON endpoint after a short pause. Returns the answer for the current
 * query only, or null while it is still loading. A failed request settles as null `value`.
 */
function useSettledSearch<T>(
  query: string,
  enabled: boolean,
  url: (query: string) => string,
  parse: (json: unknown) => T,
): Settled<T> | null {
  const [state, setState] = useState<Settled<T> | null>(null)
  useEffect(() => {
    if (!enabled || query.length < PORTAL_SEARCH_MIN_CHARS) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(url(query), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new Error('search failed')
        setState({ query, value: parse(await res.json()) })
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setState({ query, value: null })
      }
    }, SITE_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, enabled, url, parse])
  return state && state.query === query ? state : null
}

type Row = { key: string; href: string; label: string; type?: string }

/** One titled group of result links. */
function Group({ heading, rows }: { heading: string; rows: Row[] }) {
  return (
    <section aria-label={heading}>
      <h2 className="portal-search__heading">{heading}</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.key}>
            <Link href={row.href}>{row.label}</Link>
            {row.type ? <span className="portal-search__type"> {row.type}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Search box above the account screens. Account screens and settings fields
 * match on the page at once. With `account` on (the signed-in area), the
 * customer's own orders (by number), bookings and subscriptions come from
 * /api/account-search. Pages, products, posts and events come from the public
 * /api/search-suggest endpoint. A failed request leaves the rest of the list working.
 */
export function PortalSearch({
  links,
  settings = [],
  account = false,
}: {
  links: ScreenLink[]
  settings?: ScreenLink[]
  account?: boolean
}) {
  const tx = usePortalText()
  const inputId = useId()
  const [value, setValue] = useState('')
  const query = normaliseQuery(value)
  const hasQuery = query.length >= PORTAL_SEARCH_MIN_CHARS
  const screens = matchEntries(links, query)
  const fields = matchEntries(settings, query)
  // A result counts only for the query it was asked for, so a slow answer never shows under a newer query.
  const site = useSettledSearch(query, hasQuery, siteUrl, parseSite)
  const mine = useSettledSearch<AccountSearchResults>(query, hasQuery && account, accountUrl, parseAccountSearch)

  const siteItems = site?.value ?? []
  const own: AccountSearchResults = mine?.value ?? { orders: [], bookings: [], subscriptions: [] }
  const accountSettled = !account || mine !== null
  const settled = site !== null && accountSettled
  const count = screens.length + fields.length + own.orders.length + own.bookings.length + own.subscriptions.length + siteItems.length

  const toRows = (items: AccountItem[]): Row[] => items.map((item) => ({ key: `${item.href}-${item.id}`, href: item.href, label: item.label }))

  return (
    <div className="portal-search" role="search">
      <label className="portal-search__label" htmlFor={inputId}>
        {tx('search.label')}
      </label>
      <div className="portal-search__field">
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={tx('search.placeholder')}
          autoComplete="off"
        />
        {value ? (
          <button type="button" onClick={() => setValue('')} aria-label={tx('search.clear')}>
            &times;
          </button>
        ) : null}
      </div>
      {value && !hasQuery ? <p className="portal-search__hint">{tx('search.hint')}</p> : null}
      {hasQuery ? (
        <div className="portal-search__results">
          {screens.length ? (
            <Group
              heading={tx('search.accountHeading')}
              rows={screens.map((link) => ({ key: link.href, href: link.href, label: link.label }))}
            />
          ) : null}
          {fields.length ? (
            <Group
              heading={tx('search.settingsHeading')}
              rows={fields.map((link) => ({ key: link.href, href: link.href, label: link.label }))}
            />
          ) : null}
          {account && mine?.value && own.orders.length ? (
            <Group heading={tx('search.ordersHeading')} rows={toRows(own.orders)} />
          ) : null}
          {account && mine?.value && own.bookings.length ? (
            <Group heading={tx('search.bookingsHeading')} rows={toRows(own.bookings)} />
          ) : null}
          {account && mine?.value && own.subscriptions.length ? (
            <Group heading={tx('search.subscriptionsHeading')} rows={toRows(own.subscriptions)} />
          ) : null}
          {account && mine && mine.value === null ? <p>{tx('search.accountUnavailable')}</p> : null}
          {site ? (
            <section aria-label={tx('search.siteHeading')}>
              <h2 className="portal-search__heading">{tx('search.siteHeading')}</h2>
              {site.value === null ? <p>{tx('search.siteUnavailable')}</p> : null}
              {siteItems.length ? (
                <ul>
                  {siteItems.map((item) => (
                    <li key={`${item.url}-${item.title}`}>
                      <Link href={item.url}>{item.title}</Link>
                      {item.type ? <span className="portal-search__type"> {item.type}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
          {settled && count === 0 ? <p>{tx('search.none', { query })}</p> : null}
          {settled ? (
            <p className="portal-search__status" aria-live="polite">
              {tx('search.status', { count })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
