'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SectionNode } from '@/lib/sectionTree'
import { parseLocks, type Locks } from '@/features/roles/locks'

import { TEMPLATE_CATEGORY_OPTIONS, TEMPLATE_PRESETS, type TemplateKind } from './templatePresets'
import { renderTemplateThumbnail, type ThumbnailPalette } from './templateThumbnail'
import { Tooltip } from '@/components/admin/shared/Tooltip'
import { VE_TEMPLATE_LOCKS_TYPE, startLibraryDrag } from './dropSlot'

/** Fired on `window` after a template is saved so the browser refreshes "My templates". */
/** Drag payload: the section locks of a template, beside its blocks (see dragTemplate). */
export const VE_TEMPLATE_LOCKS_MIME = VE_TEMPLATE_LOCKS_TYPE

export const TEMPLATES_CHANGED_EVENT = 've-templates-changed'

/** Where an inserted template goes: the chosen spot, the end of the page, or over the selected section. */
export type TemplateInsertMode = 'here' | 'end' | 'replace'

type Filter = 'all' | 'page' | 'section' | 'mine'
type Origin = 'starter' | 'mine' | 'repo'

type PageTemplateDoc = {
  id: number | string
  name?: string | null
  description?: string | null
  kind?: string | null
  category?: string | null
  blocks?: SectionNode[]
  /** The template's section locks, copied onto a page made from it (see copyNodeLocks). */
  locks?: Locks
  previewImage?: { url?: string | null } | number | string | null
}

type RepoItem = {
  libraryId: string
  libraryLabel: string
  slug: string
  title: string
  kind: string
  category: string
  tags?: string[]
  previewUrl: string
  type?: string
  industry?: string
  style?: string
  theme?: 'light' | 'dark' | 'both'
  previewDarkUrl?: string
}

type Card = {
  key: string
  origin: Origin
  name: string
  description: string
  kind: TemplateKind
  category: string
  categoryLabel: string
  tags: string[]
  /** Local templates carry their blocks; repository ones are fetched on click. */
  blocks?: () => SectionNode[]
  /** The template's section locks (local templates only). */
  locks?: Locks
  image?: string
  /** Library items only: filter metadata and the optional dark preview. */
  meta?: { type: string; industry: string; style: string; theme: 'light' | 'dark' | 'both'; imageDark: string }
  repo?: { libraryId: string; slug: string }
  disabled?: boolean
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(TEMPLATE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]))

const asKind = (value: unknown): TemplateKind => (value === 'section' ? 'section' : 'page')

const asNodes = (value: unknown): SectionNode[] => (Array.isArray(value) ? (value as SectionNode[]) : [])

/** Native HTML5 drag payload for a template card: the blocks it would insert, dropped by VisualEditor.tsx. */
const dragTemplate = (e: React.DragEvent, blocks: SectionNode[], locks?: Locks) => {
  // The template's section locks travel beside its blocks, so a dropped template keeps them too.
  startLibraryDrag(e.dataTransfer, {
    kind: 'template',
    blocksJson: JSON.stringify(blocks),
    locksJson: locks && Object.keys(locks.nodes).length > 0 ? JSON.stringify(locks) : undefined,
  })
}

const PALETTE_VARS: Array<[keyof ThumbnailPalette, string]> = [
  ['bg', '--ve-surface-alt'],
  ['surface', '--ve-surface'],
  ['ink', '--ve-text'],
  ['muted', '--ve-border-strong'],
  ['accent', '--ve-accent'],
  ['line', '--ve-border'],
]

const readPalette = (el: HTMLElement | null): Partial<ThumbnailPalette> => {
  if (!el || typeof window === 'undefined') return {}
  const style = window.getComputedStyle(el)
  const palette: Partial<ThumbnailPalette> = {}
  for (const [key, variable] of PALETTE_VARS) {
    const value = style.getPropertyValue(variable).trim()
    if (value) palette[key] = value
  }
  return palette
}

const previewUrlOf = (doc: PageTemplateDoc): string | undefined => {
  const image = doc.previewImage
  if (image && typeof image === 'object' && typeof image.url === 'string' && image.url) return image.url
  return undefined
}

const TYPE_LABELS: Record<string, string> = {
  page: 'Whole page',
  section: 'Section',
  'shop-page': 'Shop page',
  header: 'Header',
  footer: 'Footer',
  hero: 'Hero',
  loop: 'Loop',
  'site-template': 'Site template',
  popup: 'Popup',
}

export const TemplateBrowser: React.FC<{ onPickTemplate: (blocks: SectionNode[], locks?: Locks, mode?: TemplateInsertMode) => void }> = ({ onPickTemplate }) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [palette, setPalette] = useState<Partial<ThumbnailPalette>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<PageTemplateDoc[] | null>(null)
  const [docsError, setDocsError] = useState<string | null>(null)
  const [repoItems, setRepoItems] = useState<RepoItem[]>([])
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({})
  const [reloadTick, setReloadTick] = useState(0)
  const [insertMode, setInsertMode] = useState<TemplateInsertMode>('here')
  const [typeFilter, setTypeFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  const [themeFilter, setThemeFilter] = useState<'' | 'light' | 'dark'>('')
  const [previewDark, setPreviewDark] = useState(false)

  useEffect(() => {
    setPalette(readPalette(rootRef.current))
  }, [])

  useEffect(() => {
    const onChanged = () => setReloadTick((t) => t + 1)
    window.addEventListener(TEMPLATES_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TEMPLATES_CHANGED_EVENT, onChanged)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/page-templates?limit=100&depth=1&sort=-updatedAt', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then((json: { docs?: PageTemplateDoc[] }) => {
        if (cancelled) return
        setDocs(Array.isArray(json?.docs) ? json.docs : [])
        setDocsError(null)
      })
      .catch((err) => {
        if (!cancelled) setDocsError(String((err as Error)?.message || err))
      })
    return () => {
      cancelled = true
    }
  }, [reloadTick])

  // Repository templates: fetched once. Any refusal (not signed in with the right role, feature off, route
  // missing) or an empty list just hides the source - it is optional.
  useEffect(() => {
    let cancelled = false
    fetch('/api/template-libraries', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((json: { items?: RepoItem[] } | null) => {
        if (cancelled || !json || !Array.isArray(json.items)) return
        setRepoItems(json.items)
      })
      .catch((): void => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  const cards = useMemo(() => {
    const list: Card[] = []
    for (const preset of TEMPLATE_PRESETS) {
      list.push({
        key: `starter:${preset.slug}`,
        origin: 'starter',
        name: preset.name,
        description: preset.description,
        kind: preset.kind,
        category: preset.category,
        categoryLabel: CATEGORY_LABELS[preset.category] || 'Other',
        tags: [],
        blocks: preset.blocks,
        image: renderTemplateThumbnail(preset.blocks(), palette),
      })
    }
    for (const doc of docs || []) {
      const blocks = asNodes(doc.blocks)
      const cat = doc.category && CATEGORY_LABELS[doc.category] ? doc.category : 'other'
      list.push({
        key: `mine:${doc.id}`,
        origin: 'mine',
        name: doc.name || 'Untitled',
        description: doc.description || (blocks.length > 0 ? `${blocks.length} block${blocks.length === 1 ? '' : 's'}` : 'Empty template'),
        kind: asKind(doc.kind),
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat],
        tags: [],
        blocks: () => blocks,
        locks: parseLocks(doc.locks),
        image: previewUrlOf(doc) || renderTemplateThumbnail(blocks, palette),
        disabled: blocks.length === 0,
      })
    }
    for (const item of repoItems) {
      const cat = item.category || 'General'
      list.push({
        key: `library:${item.libraryId}:${item.slug}`,
        origin: 'repo',
        name: item.title || item.slug,
        description: item.libraryLabel,
        kind: asKind(item.kind),
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat] || cat,
        tags: item.tags || [],
        image: item.previewUrl || undefined,
        meta: { type: item.type || item.kind, industry: item.industry || '', style: item.style || '', theme: item.theme || 'both', imageDark: item.previewDarkUrl || '' },
        repo: { libraryId: item.libraryId, slug: item.slug },
      })
    }
    return list
  }, [docs, repoItems, palette])

  // Cards that pass the top filter and the search box; the category dropdown counts come from these.
  const byFilter = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return cards.filter((card) => {
      if (filter === 'mine' && card.origin !== 'mine') return false
      if (typeFilter && card.meta?.type !== typeFilter) return false
      if (industryFilter && card.meta?.industry !== industryFilter) return false
      if (styleFilter && card.meta?.style !== styleFilter) return false
      if (themeFilter && !(card.meta ? card.meta.theme === 'both' || card.meta.theme === themeFilter : false)) return false
      if ((filter === 'page' || filter === 'section') && card.kind !== filter) return false
      if (!needle) return true
      return (
        card.name.toLowerCase().includes(needle) ||
        card.description.toLowerCase().includes(needle) ||
        card.categoryLabel.toLowerCase().includes(needle) ||
        card.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    })
  }, [cards, filter, query, typeFilter, industryFilter, styleFilter, themeFilter])

  // Choices for the library pickers come from the library items only.
  const facets = useMemo(() => {
    const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    const lib = cards.filter((c) => c.meta)
    return {
      types: Object.keys(TYPE_LABELS).filter((t) => lib.some((c) => c.meta?.type === t)),
      industries: uniq(lib.map((c) => c.meta?.industry || '')),
      styles: uniq(lib.map((c) => c.meta?.style || '')),
    }
  }, [cards])

  const categoryChoices = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const card of byFilter) {
      const entry = counts.get(card.category)
      if (entry) entry.count += 1
      else counts.set(card.category, { label: card.categoryLabel, count: 1 })
    }
    const known = TEMPLATE_CATEGORY_OPTIONS.map((o) => o.value as string).filter((v) => counts.has(v))
    const extra = [...counts.keys()].filter((k) => !CATEGORY_LABELS[k]).sort()
    return [...known, ...extra].map((key) => ({ key, ...(counts.get(key) as { label: string; count: number }) }))
  }, [byFilter])

  const activeCategory = category === 'all' || categoryChoices.some((c) => c.key === category) ? category : 'all'
  const visible = activeCategory === 'all' ? byFilter : byFilter.filter((card) => card.category === activeCategory)

  const pickRepo = useCallback(
    async (card: Card) => {
      if (!card.repo || loadingKey) return
      setLoadingKey(card.key)
      try {
        // The server loads the item again, saves its pictures to the media gallery (reusing any already there)
        // and returns the tree pointed at them. The browser sends only the library id and the item name.
        const res = await fetch('/api/template-libraries/use', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ library: card.repo.libraryId, item: card.repo.slug, prefer: previewDark ? 'dark' : themeFilter || 'light' }),
        })
        const json = (await res.json().catch((): null => null)) as { ok?: boolean; error?: string; tree?: unknown } | null
        const tree = asNodes(json?.tree)
        if (!res.ok || !json || json.ok === false || tree.length === 0) {
          throw new Error(json?.error || 'That template could not be loaded.')
        }
        onPickTemplate(tree, undefined, insertMode)
        const saved = Number((json as { saved?: number }).saved ?? 0)
        const reused = Number((json as { reused?: number }).reused ?? 0)
        const themed = Number((json as { themed?: number }).themed ?? 0)
        setToast(`Added "${card.name}".${themed > 0 ? ` ${themed} colour${themed === 1 ? '' : 's'} now follow your theme.` : ''}${saved + reused > 0 ? ` ${saved} picture${saved === 1 ? '' : 's'} saved to Media${reused > 0 ? `, ${reused} already there` : ''}.` : ''}`)
      } catch (err) {
        setToast(`Could not add "${card.name}": ${(err as Error)?.message || 'something went wrong.'}`)
      } finally {
        setLoadingKey(null)
      }
    },
    [loadingKey, onPickTemplate, insertMode, previewDark, themeFilter],
  )

  const onPick = (card: Card) => {
    if (card.disabled) return
    if (card.repo) {
      void pickRepo(card)
      return
    }
    if (card.blocks) onPickTemplate(card.blocks(), card.locks, insertMode)
  }

  const FILTERS: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'page', label: 'Page' },
    { key: 'section', label: 'Section' },
    { key: 'mine', label: 'My templates' },
  ]

  const emptyMessage = (): string => {
    if (filter === 'mine') {
      if (docsError) return `Couldn't load your templates: ${docsError}`
      if (docs === null) return 'Loading...'
      if (query.trim() || docs.length > 0) return 'None of your templates match. Try a different search or category.'
      return 'You have not saved any templates yet. Use "Save as template" in the top bar to keep a section or a whole page for later.'
    }
    return 'No templates match. Try a different search, category or filter.'
  }

  return (
    <div className="ve-tpl" ref={rootRef}>
      <div className="ve-tpl__filters" role="group" aria-label="Template type">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`ve-tpl__filter ${filter === f.key ? 've-tpl__filter--active' : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <select className="ve-tpl__select" aria-label="Insert template" value={insertMode} onChange={(e) => setInsertMode(e.target.value as TemplateInsertMode)}>
        <option value="here">Insert at the chosen spot</option>
        <option value="end">Insert at the end of the page</option>
        <option value="replace">Replace the selected section</option>
      </select>

      {facets.types.length + facets.industries.length + facets.styles.length > 0 && (
        <div className="ve-tpl__facets" role="group" aria-label="Examples filters" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {facets.types.length > 0 && (
            <select className="ve-tpl__select" aria-label="Example type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Any type</option>
              {facets.types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          )}
          {facets.industries.length > 0 && (
            <select className="ve-tpl__select" aria-label="Example industry" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}>
              <option value="">Any industry</option>
              {facets.industries.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {facets.styles.length > 0 && (
            <select className="ve-tpl__select" aria-label="Example colour style" value={styleFilter} onChange={(e) => setStyleFilter(e.target.value)}>
              <option value="">Any style</option>
              {facets.styles.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          <select className="ve-tpl__select" aria-label="Example light or dark" value={themeFilter} onChange={(e) => setThemeFilter(e.target.value as '' | 'light' | 'dark')}>
            <option value="">Light or dark</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={previewDark} onChange={(e) => setPreviewDark(e.target.checked)} /> Dark previews
          </label>
        </div>
      )}

      <select className="ve-tpl__select" aria-label="Template category" value={activeCategory} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All categories ({byFilter.length})</option>
        {categoryChoices.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label} ({c.count})
          </option>
        ))}
      </select>

      <input
        type="search"
        className="ve-library__search"
        placeholder="Search templates..."
        aria-label="Search templates"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {docsError && filter !== 'mine' && <p className="ve-library__empty">Couldn&apos;t load your saved templates: {docsError}</p>}

      {visible.length === 0 ? (
        <p className="ve-library__empty">{emptyMessage()}</p>
      ) : (
        <div className="ve-tpl__grid">
          {visible.map((card) => {
            const loading = loadingKey === card.key
            const shownImage = previewDark && card.meta?.imageDark ? card.meta.imageDark : card.image
            const showImage = shownImage && !brokenImages[card.key]
            return (
              <Tooltip text={card.description} key={card.key} placement="bottom"><div
                role="button"
                tabIndex={card.disabled ? -1 : 0}
                className="ve-tpl__card"
                draggable={Boolean(card.blocks) && !card.disabled}
                onDragStart={(e) => card.blocks && dragTemplate(e, card.blocks(), card.locks)}
                onClick={() => {
                  if (!(card.disabled || (loadingKey !== null && !loading))) onPick(card)
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !(card.disabled || (loadingKey !== null && !loading))) {
                    e.preventDefault()
                    onPick(card)
                  }
                }}
                aria-disabled={card.disabled || (loadingKey !== null && !loading)}
                aria-busy={loading}
                aria-label={`Insert template ${card.name}`}
              >
                <span className="ve-tpl__thumb">
                  {showImage ? (
                    <img
                      src={shownImage}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      onError={() => setBrokenImages((prev) => ({ ...prev, [card.key]: true }))}
                    />
                  ) : (
                    <span className="ve-tpl__thumb-empty">No preview</span>
                  )}
                  {loading && <span className="ve-tpl__loading">Adding...</span>}
                </span>
                <span className="ve-tpl__name">{card.name}</span>
                <span className="ve-tpl__chips">
                  <span className="ve-tpl__chip">{card.categoryLabel}</span>
                  {card.origin === 'repo' && <span className="ve-tpl__chip ve-tpl__chip--repo">Example</span>}
                  {card.origin === 'mine' && <span className="ve-tpl__chip ve-tpl__chip--mine">{card.kind === 'section' ? 'Section' : 'Page'}</span>}
                </span>
              </div></Tooltip>
            )
          })}
        </div>
      )}

      {toast && (
        <div className="ve-tpl__toast" role="alert">
          {toast}
        </div>
      )}
    </div>
  )
}
