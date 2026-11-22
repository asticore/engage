'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { CollapsibleCard } from '@/admin/components/CollapsibleCard'
import { useCardOpen } from '@/admin/components/collapseStore'
import { ChecklistPanel } from '@/features/pagespeed/ui/ChecklistPanel'
import type { ChecklistRow } from '@/features/pagespeed/checklist'
import '@/features/pagespeed/ui/pagespeed.css'
import './page-checks.css'

type Detection = { id: string; state: 'valid' | 'warnings' | 'errors' | 'missing'; missingRequired: string[]; missingRecommended: string[] }
type CatalogueItem = { id: string; label: string; kind: 'content' | 'markup'; markupOnly: boolean; howTo: string }
type Loaded = {
  testable: boolean
  reason?: string
  url?: string
  testUrl?: string
  snippets?: Detection[]
  targets: string[]
  suggested: string[]
  catalogue: CatalogueItem[]
  checklist?: ChecklistRow[]
  scores?: Record<string, number | null>
  crawl?: { at: string; issues: string[]; brokenLinks: string[] } | null
}

const CARD_ID = 'page-checks'
const STATE_WORD: Record<Detection['state'], string> = { valid: 'Detected and valid', warnings: 'Detected, has warnings', errors: 'Detected, has errors', missing: 'Missing' }

function SnippetPanel({ data, onTargets, saving }: { data: Loaded; onTargets: (types: string[]) => void; saving: boolean }) {
  const detections = data.snippets ?? []
  const byId = new Map(detections.map((d) => [d.id, d]))
  const label = (id: string): string => data.catalogue.find((c) => c.id === id)?.label ?? id
  const howTo = (id: string): string => data.catalogue.find((c) => c.id === id)?.howTo ?? ''
  const want = new Set(data.targets)
  // Only ticked types and types the page already has get a row; the rest wait in the "Add a type" menu.
  const shown = detections.filter((d) => want.has(d.id) || d.state !== 'missing')
  const menu = data.catalogue.filter((c) => !shown.some((d) => d.id === c.id))
  const hasNone = data.targets.length === 0
  return (
    <div className="pc__snippets">
      <h3 className="ps__h">Featured snippets and rich results</h3>
      <p className="ps__muted ps__help">
        Tick the snippet types this page should win in Google. Several can be ticked: a table, a short description and bullets let Google read the page in more than one format.
        {data.testUrl ? <> <a href={data.testUrl} target="_blank" rel="noopener noreferrer">Check the page in Google&apos;s Rich Results Test</a>.</> : null}
      </p>
      {hasNone && data.suggested.length > 0 && (
        <p className="pc__suggest">
          Suggested for this page: {data.suggested.map(label).join(', ')}.{' '}
          <button type="button" className="btn" disabled={saving} onClick={() => onTargets(data.suggested)}>Use these</button>
        </p>
      )}
      <ul className="pc__rows">
        {shown.map((d) => {
          const targeted = want.has(d.id)
          const item = data.catalogue.find((c) => c.id === d.id)
          return (
            <li key={d.id} className={`pc__row pc__row--${d.state}`}>
              <label className="pc__target">
                <input type="checkbox" checked={targeted} disabled={saving} onChange={() => onTargets(targeted ? data.targets.filter((t) => t !== d.id) : [...data.targets, d.id])} />
                <span className="pc__name">{label(d.id)}</span>
              </label>
              <span className={`pc__state pc__state--${d.state}`}>{STATE_WORD[d.state]}</span>
              {item?.kind === 'content' && d.state === 'valid' ? <span className="ps__muted">Found in the page content (no markup needed).</span> : null}
              {d.state === 'missing' && <span className="pc__how">{howTo(d.id)}</span>}
              {d.missingRequired.length > 0 && <span className="pc__how">Required and missing: {d.missingRequired.join(', ')}.</span>}
              {d.missingRecommended.length > 0 && <span className="pc__how">Recommended and missing: {d.missingRecommended.join(', ')}.</span>}
            </li>
          )
        })}
      </ul>
      {menu.length > 0 && (
        <label className="pc__add">
          <span className="ps__muted">Add a type </span>
          <select
            value=""
            disabled={saving}
            onChange={(event) => {
              if (event.target.value) onTargets([...data.targets, event.target.value])
            }}
          >
            <option value="">Choose...</option>
            {menu.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
      )}
      {byId.size === 0 && <p className="ps__muted">Nothing could be read from the page yet.</p>}
    </div>
  )
}

function Body({ collectionSlug, id }: { collectionSlug: string; id: number }) {
  const [open] = useCardOpen(CARD_ID)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const requested = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin-seo-page?collection=${encodeURIComponent(collectionSlug)}&id=${id}`)
      const json = (await response.json().catch((): null => null)) as (Loaded & { error?: string }) | null
      if (!response.ok || !json) throw new Error(json?.error || 'Could not check the page.')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the page.')
    } finally {
      setLoading(false)
    }
  }, [collectionSlug, id])

  useEffect(() => {
    if (!open || requested.current) return
    requested.current = true
    void load()
  }, [open, load])

  const saveTargets = async (types: string[]) => {
    setSaving(true)
    try {
      const response = await fetch('/api/admin-seo-page', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: collectionSlug, id, types }) })
      const json = (await response.json().catch((): null => null)) as { targets?: string[]; error?: string } | null
      if (!response.ok || !json?.targets) throw new Error(json?.error || 'Could not save.')
      setData((current) => (current ? { ...current, targets: json.targets as string[] } : current))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ps pc">
      {!data && !error && <p className="ps__muted">Loading...</p>}
      {error && <p className="ps__error" role="alert">{error}</p>}
      {data && !data.testable && <p className="ps__muted">{data.reason}</p>}
      {data?.testable && (
        <>
          <div className="ps__bar">
            <button type="button" className="btn" disabled={loading} onClick={() => void load()}>{loading ? 'Checking...' : 'Check again'}</button>
            {data.url && <span className="ps__muted">{data.url}</span>}
          </div>
          <SnippetPanel data={data} onTargets={(types) => void saveTargets(types)} saving={saving} />
          {data.crawl && (
            <div>
              <h3 className="ps__h">Last site audit ({new Date(data.crawl.at).toLocaleDateString()})</h3>
              {data.crawl.brokenLinks.length === 0 ? (
                <p className="ps__muted">No broken internal links found on this page.</p>
              ) : (
                <>
                  <p className="ps__muted">This page links to pages that return an error:</p>
                  <ul>{data.crawl.brokenLinks.map((href) => <li key={href}>{href}</li>)}</ul>
                </>
              )}
            </div>
          )}
          {data.checklist && (
            <div>
              <h3 className="ps__h">SEO, accessibility and technical checks</h3>
              <p className="ps__muted ps__help">
                Our own checks on the live page, the same ones the site audit uses. Findings are marked by group: SEO, Accessibility or Technical. Contrast, tap size and focus order need a browser, so
                the PageSpeed test below covers them.
              </p>
              <ChecklistPanel rows={data.checklist} groupLabelOverride={{ 'best-practices': 'Technical', accessibility: 'Accessibility', seo: 'SEO' }} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Card on the edit screen of pages, posts, products and events (items 16m and 16n): which Google snippet types the page
 * supports, the ones the author is aiming for, and the page's SEO and accessibility checks in one list.
 */
export function PageChecksCard({ collectionSlug, id }: { collectionSlug: string; id?: number }) {
  if (id === undefined) return null
  return (
    <CollapsibleCard id={CARD_ID} title="Snippets and page checks" className="doc-page-checks-card">
      <Body collectionSlug={collectionSlug} id={id} />
    </CollapsibleCard>
  )
}

export default PageChecksCard
