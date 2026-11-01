'use client'

import React, { useMemo, useState } from 'react'
import { AdminLink } from '@/admin/adminRoute/AdminLink'
import type { HubScreen } from '@/admin/settingsHub'

export type HubPage = { key: string; title: string; href: string; description: string }

/** One searchable setting, page or screen. `href` is admin-relative; `context` names where it lives. */
export type HubItem = { label: string; description: string; context: string; href: string }

const MAX_RESULTS = 60

const Card: React.FC<{ href: string; title: string; description: string; context?: string }> = ({ href, title, description, context }) => (
  <AdminLink path={href} className="settings-page__link-card">
    <div className="settings-page__link-card-content">
      <h3 className="settings-page__link-card-title">{title}</h3>
      <p className="settings-page__link-card-description">{description}</p>
      {context && <p className="settings-hub__result-page">{context}</p>}
    </div>
    <div className="settings-page__link-card-icon">→</div>
  </AdminLink>
)

/** Settings hub: the page cards and other screens, or the search results while a query is typed. */
export const SettingsHubClient: React.FC<{ pages: HubPage[]; screens: HubScreen[]; items: HubItem[] }> = ({ pages, screens, items }) => {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const results = useMemo(() => {
    if (!needle) return []
    return items.filter((item) => `${item.label} ${item.description} ${item.context}`.toLowerCase().includes(needle))
  }, [items, needle])

  return (
    <div className="settings-page">
      <div className="settings-page__header">
        <h1 className="settings-page__title">Settings</h1>
        <p className="settings-page__description">Every settings screen in one place. Search for a setting by its name or what it does.</p>
        <div className="settings-hub__search">
          <label htmlFor="settings-hub-search">Search settings</label>
          <input
            id="settings-hub-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="For example: tax, cookie, sitemap"
            autoComplete="off"
          />
        </div>
      </div>

      {needle ? (
        <>
          <p aria-live="polite" className="settings-hub__result-page">
            {results.length === 0 ? `No settings match "${query.trim()}".` : `${results.length} ${results.length === 1 ? 'match' : 'matches'}${results.length > MAX_RESULTS ? `, showing the first ${MAX_RESULTS}` : ''}`}
          </p>
          <div className="settings-page__links">
            {results.slice(0, MAX_RESULTS).map((item, index) => (
              <Card key={`${item.href}:${index}`} href={item.href} title={item.label} description={item.description} context={item.context} />
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="settings-hub__section-title">Settings pages</h2>
          <div className="settings-page__links">
            {pages.map((page) => (
              <Card key={page.key} href={page.href} title={page.title} description={page.description} />
            ))}
          </div>
          <h2 className="settings-hub__section-title">Other settings screens</h2>
          <div className="settings-page__links">
            {screens.map((screen) => (
              <Card key={screen.key} href={screen.href} title={screen.label} description={screen.description} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default SettingsHubClient
