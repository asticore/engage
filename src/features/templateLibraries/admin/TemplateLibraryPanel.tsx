'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { EMPTY_LIBRARY_FILTER, filterLibraryItems, isLibraryFilterActive, libraryCategories, type LibraryItemFilter } from '../filter'
import type { LibraryItemRow, LibrarySummary } from '../types'

type Listing = { ok?: boolean; error?: string; libraries?: LibrarySummary[]; items?: LibraryItemRow[] }

/**
 * The Templates hub's Library tab: every item of every enabled library, with a filter. Each item can
 * be turned into a new draft page; the page opens in the visual editor. Inserting a section into a
 * page happens inside the visual editor, where the same library list appears.
 */
export const TemplateLibraryPanel: React.FC<{ settingsHref: string }> = ({ settingsHref }) => {
  const t = useAdminT()
  const [listing, setListing] = useState<Listing | null>(null)
  const [filter, setFilter] = useState<LibraryItemFilter>(EMPTY_LIBRARY_FILTER)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/template-libraries', { credentials: 'include' })
      .then(async (res) => {
        const json = (await res.json().catch((): null => null)) as Listing | null
        if (cancelled) return
        if (!res.ok || !json || json.ok === false) setListing({ ok: false, error: json?.error || t('templateLibraries.loadFailed') })
        else setListing(json)
      })
      .catch((): void => {
        if (!cancelled) setListing({ ok: false, error: t('templateLibraries.loadFailed') })
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const allItems = useMemo(() => listing?.items ?? [], [listing])
  const items = useMemo(() => filterLibraryItems(allItems, filter), [allItems, filter])
  const categories = useMemo(() => libraryCategories(allItems), [allItems])
  const usableLibraries = (listing?.libraries ?? []).filter((library) => library.enabled && !library.error)
  const filterActive = isLibraryFilterActive(filter)

  const createPage = async (item: LibraryItemRow) => {
    setBusy(item.key)
    setError(null)
    try {
      const res = await fetch('/api/template-libraries/create-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ library: item.libraryId, item: item.slug }),
      })
      const json = (await res.json().catch((): null => null)) as { ok?: boolean; error?: string; editHref?: string } | null
      if (!res.ok || !json || json.ok === false || !json.editHref) {
        setError(json?.error || t('templateLibraries.actionFailed'))
        setBusy(null)
        return
      }
      window.location.assign(json.editHref)
    } catch {
      setError(t('templateLibraries.actionFailed'))
      setBusy(null)
    }
  }

  const libraryErrors = (listing?.libraries ?? []).filter((library) => library.error)
  const libraryCount = (listing?.libraries ?? []).filter((library) => library.enabled && !library.error).length

  return (
    <div className="lst-panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', margin: '0 0 12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{t('templateLibraries.filter')}</span>
          <input
            type="search"
            value={filter.query}
            placeholder={t('templateLibraries.filter')}
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
            style={{ padding: '6px 8px', minWidth: 220 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{t('templateLibraries.filterLibrary')}</span>
          <select value={filter.libraryId} onChange={(event) => setFilter({ ...filter, libraryId: event.target.value })} style={{ padding: '6px 8px' }}>
            <option value="">{t('templateLibraries.filterAll')}</option>
            {usableLibraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{t('templateLibraries.filterKind')}</span>
          <select
            value={filter.kind}
            onChange={(event) => setFilter({ ...filter, kind: event.target.value as LibraryItemFilter['kind'] })}
            style={{ padding: '6px 8px' }}
          >
            <option value="">{t('templateLibraries.filterAll')}</option>
            <option value="page">{t('templateLibraries.kindPage')}</option>
            <option value="section">{t('templateLibraries.kindSection')}</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{t('templateLibraries.filterCategory')}</span>
          <select value={filter.category} onChange={(event) => setFilter({ ...filter, category: event.target.value })} style={{ padding: '6px 8px' }}>
            <option value="">{t('templateLibraries.filterAll')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        {filterActive ? (
          <button type="button" className="btn btn--style-secondary btn--size-small" onClick={() => setFilter(EMPTY_LIBRARY_FILTER)}>
            {t('templateLibraries.clearFilters')}
          </button>
        ) : null}
        <a href={settingsHref}>{t('templateLibraries.title')}</a>
      </div>
      {listing && listing.ok !== false && filterActive ? (
        <p role="status" style={{ margin: '0 0 12px', fontSize: 13 }}>
          {t('templateLibraries.resultCount', { shown: items.length, total: allItems.length })}
        </p>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
      {listing && listing.ok === false ? <p role="alert">{listing.error}</p> : null}
      {libraryErrors.map((library) => (
        <p key={library.id} role="status" style={{ margin: '0 0 8px', fontSize: 13 }}>
          <strong>{library.label}</strong>: {library.error}
        </p>
      ))}

      {listing && listing.ok !== false && items.length === 0 ? (
        <p className="list-empty">{libraryCount === 0 ? t('templateLibraries.empty') : t('templateLibraries.noItems')}</p>
      ) : null}

      <ul
        aria-label={t('templateLibraries.tabLibrary')}
        style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {items.map((item) => (
          <li key={item.key} style={{ border: '1px solid var(--theme-elevation-150, #ccc)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.previewUrl ? (
              <img src={item.previewUrl} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 4, background: '#f3f3f3' }} />
            ) : null}
            <div>
              <strong>{item.title}</strong>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {item.kind === 'page' ? t('templateLibraries.kindPage') : t('templateLibraries.kindSection')} · {item.libraryLabel} · {item.category}
              </div>
            </div>
            {item.kind === 'page' ? (
              <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy !== null} onClick={() => void createPage(item)}>
                {busy === item.key ? t('templateLibraries.creating') : t('templateLibraries.createPage')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TemplateLibraryPanel
