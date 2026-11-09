'use client'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import type { SectionNode } from '@/lib/sectionTree'
import type { Locks } from '@/features/roles/locks'

import { BLOCK_CATEGORIES, libraryCards, type BlockDef } from './blockSchemas'
import { globalCards, globalNode, type GlobalCard } from './libraryGlobals'
import { commercePresetCards, commercePresetNode, filterCommercePresetCards } from './libraryCommercePresets'
import { createFormFromPreset, filterFormPresetCards, formPresetCards } from './libraryFormPresets'
import { TemplateBrowser } from './TemplateBrowser'
import { createStorageStore, useStoredString } from '@/lib/clientStore'
import { FAVS_KEY, RECENTS_KEY, pushRecent, sanitiseList, toggleFavourite } from './libraryRecents'
import './navLibraryPresets.css'
import { Tooltip } from '@/components/admin/shared/Tooltip'
import { startLibraryDrag } from './dropSlot'
import { libraryCategories, rankCards } from './libraryModel'

const CATEGORY_KEY = 've-library-category'
const DENSITY_KEY = 've-library-density'
const COLLAPSED_KEY = 've-library-collapsed'

// Stored choices are read through useSyncExternalStore so the first client render equals the server render.
const categoryStore = createStorageStore(CATEGORY_KEY)
const densityStore = createStorageStore(DENSITY_KEY)
const collapsedStore = createStorageStore(COLLAPSED_KEY)
const recentsStore = createStorageStore(RECENTS_KEY)
const favsStore = createStorageStore(FAVS_KEY)

type Source = 'blocks' | 'templates'
type View = 'compact' | 'list'

/** Stored view: only 'list' is kept; the retired 'comfortable' value (and anything else) means compact. */
export const parseView = (raw: string | null): View => (raw === 'list' ? 'list' : 'compact')

/** Collapsed group ids from storage; any malformed value is treated as nothing collapsed. */
export function parseCollapsed(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />
  </svg>
)
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M2 3h12v2H2zM2 7h12v2H2zM2 11h12v2H2z" />
  </svg>
)
const ChevronIcon = () => (
  <svg className="ve-library__chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** A category group with a clickable header; `forceOpen` (an active search) ignores the remembered collapsed state. */
const Group: React.FC<{
  id: string
  title: string
  collapsed: boolean
  forceOpen: boolean
  onToggle: (id: string) => void
  className?: string
  testId?: string
  children: React.ReactNode
}> = ({ id, title, collapsed, forceOpen, onToggle, className, testId, children }) => {
  const open = forceOpen || !collapsed
  return (
    <div className={`ve-library__group${className ? ` ${className}` : ''}`} data-testid={testId} data-group={id}>
      <h4 className="ve-library__group-title">
        <button
          type="button"
          className="ve-library__group-toggle"
          aria-expanded={open}
          aria-controls={`ve-lib-group-${id}`}
          onClick={() => onToggle(id)}
        >
          <ChevronIcon />
          <span>{title}</span>
        </button>
      </h4>
      <div id={`ve-lib-group-${id}`} hidden={!open}>
        {children}
      </div>
    </div>
  )
}

/**
 * The Elements tab of the editor dock (src/views/VisualEditor.tsx renders it
 * permanently on the left, alongside the Settings tab - see that file for
 * why this stopped being a popup: Elementor doesn't make you close a modal
 * to see the canvas, and neither should this).
 *
 * Two sources, picked with the pill tabs at the top: raw Blocks (search +
 * category, same as before) and Templates - either a curated multi-block
 * starter (templatePresets.ts) or a saved Page Template or a repository template (see TemplateBrowser.tsx). Both insert at whatever target the caller
 * is tracking (see `targetLabel`, set by whichever "+" was clicked).
 */
export const ElementLibrary: React.FC<{
  targetLabel: string
  onPickBlock: (blockType: string) => void
  onPickTemplate: (blocks: SectionNode[], locks?: Locks) => void
  /** Form builder: only layout and form fields are offered, and page templates are hidden. */
  formMode?: boolean
}> = ({ targetLabel, onPickBlock, onPickTemplate, formMode }) => {
  const t = useAdminT()
  const [source, setSource] = useState<Source>('blocks')
  const [query, setQuery] = useState('')
  const savedCategory = useStoredString(categoryStore)
  const allCards = useMemo(() => libraryCards({ formMode }), [formMode])
  // Same-named categories merged ("Layout" + "Layout elements") and empty ones (e.g. Form fields outside forms) dropped.
  const categories = useMemo(() => libraryCategories(BLOCK_CATEGORIES, allCards), [allCards])
  const category = savedCategory && categories.some((c) => c.key === savedCategory) ? savedCategory : 'all'
  const changeCategory = (key: string) => categoryStore.set(key)
  const density = parseView(useStoredString(densityStore))
  const collapsedRaw = useStoredString(collapsedStore)
  const collapsed = useMemo(() => parseCollapsed(collapsedRaw), [collapsedRaw])
  const toggleGroup = (id: string) =>
    collapsedStore.set(JSON.stringify(collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id]))
  const searching = query.trim() !== ''
  const recentsRaw = useStoredString(recentsStore)
  const favsRaw = useStoredString(favsStore)
  const recents = useMemo(() => sanitiseList(recentsRaw), [recentsRaw])
  const favs = useMemo(() => sanitiseList(favsRaw), [favsRaw])

  const pick = useCallback(
    (slug: string) => {
      const next = pushRecent(recents, slug)
      recentsStore.set(JSON.stringify(next))
      onPickBlock(slug)
    },
    [recents, onPickBlock],
  )
  const toggleFav = (slug: string) => {
    const next = toggleFavourite(favs, slug)
    favsStore.set(JSON.stringify(next))
  }

  const [globals, setGlobals] = useState<GlobalCard[]>([])
  useEffect(() => {
    if (formMode) return
    let cancelled = false
    fetch('/api/reusable-sections?limit=100&depth=0&sort=name', { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<{ docs?: unknown }>) : null))
      .then((json) => {
        if (!cancelled && json) setGlobals(globalCards(json.docs))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [formMode])
  const globalMatches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return globals.filter((g) => !needle || g.name.toLowerCase().includes(needle) || g.description.toLowerCase().includes(needle) || 'global'.includes(needle))
  }, [globals, query])

  /** Inserting a preset first creates a saved form document (the form block renders only saved forms). */
  const FORM_PRESET_INSERT_READY = true
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const formCards = useMemo(() => filterFormPresetCards(formPresetCards(), query), [query])

  const shopCards = useMemo(() => filterCommercePresetCards(commercePresetCards(), query), [query])

  const results = useMemo(() => {
    const keys = categories.find((c) => c.key === category)?.keys
    return rankCards(allCards, query).filter((block) => category === 'all' || Boolean(keys?.includes(block.category)))
  }, [query, category, categories, allCards])

  const bySlug = useMemo(() => new Map(libraryCards({ formMode }).map((b) => [b.slug, b])), [formMode])
  const recentBlocks = recents.map((s) => bySlug.get(s)).filter((b): b is BlockDef => Boolean(b))
  const favBlocks = favs.map((s) => bySlug.get(s)).filter((b): b is BlockDef => Boolean(b))

  const renderCard = (block: BlockDef) => (
                                          <Tooltip text={`${block.label}: ${block.description}`} key={block.slug} placement="bottom"><div
                        role="button"
                        tabIndex={0}
                        className="ve-library__card"
                        draggable
                        onDragStart={(e) => {
                          // Native HTML5 DnD, not @dnd-kit - it's the only thing that
                          // can hand a drag off across the canvas iframe boundary, since
                          // dataTransfer belongs to the browser's drag session rather
                          // than either document. Cards are divs, not buttons: Firefox/Safari don't start a drag
                          // from a <button>. The drop is handled in VisualEditor.tsx.
                          startLibraryDrag(e.dataTransfer, { kind: 'block', slug: block.slug })
                        }}
                        onClick={() => pick(block.slug)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            pick(block.slug)
                          }
                        }}
                        aria-label={`${block.label}: ${block.description}`}
                      >
                        <span className="ve-library__card-icon">{block.icon}</span>
                        <span className="ve-library__card-label">{block.label}</span>
                        {density === 'list' && <span className="ve-library__card-desc">{block.description}</span>}
                        <button
                          type="button"
                          className={`ve-lib-star${favs.includes(block.slug) ? ' ve-lib-star--on' : ''}`}
                          aria-label={favs.includes(block.slug) ? `Remove ${block.label} from favourites` : `Add ${block.label} to favourites`}
                          aria-pressed={favs.includes(block.slug)}
                          draggable={false}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFav(block.slug)
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {favs.includes(block.slug) ? String.fromCharCode(9733) : String.fromCharCode(9734)}
                        </button>
                      </div></Tooltip>
                      )

  return (
    <div className={`ve-library ve-library--${density}`} data-density={density}>
      <div className="ve-library__controls">
        <div className="ve-library__source-tabs" role="tablist" aria-label={t('ve.lib.sourceTabs')}>
          <button
            type="button"
            role="tab"
            aria-selected={source === 'blocks'}
            className={`ve-library__source-tab ${source === 'blocks' ? 've-library__source-tab--active' : ''}`}
            onClick={() => setSource('blocks')}
          >
            Blocks
          </button>
          {!formMode && (
            <button
              type="button"
              role="tab"
              aria-selected={source === 'templates'}
              className={`ve-library__source-tab ${source === 'templates' ? 've-library__source-tab--active' : ''}`}
              onClick={() => setSource('templates')}
            >
              Templates
            </button>
          )}
        </div>

        {source === 'blocks' && (
          <>
            <input
              type="search"
              className="ve-library__search"
              placeholder={t('ve.lib.search')}
              aria-label={t('ve.lib.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="ve-library__filter-row">
              <div className="ve-library__views" role="group" aria-label={t('ve.lib.views')}>
                <button
                  type="button"
                  className="ve-library__view-btn"
                  data-testid="ve-lib-view-compact"
                  aria-label={t('ve.lib.viewCompact')}
                  title={t('ve.lib.viewCompact')}
                  aria-pressed={density === 'compact'}
                  onClick={() => densityStore.set('compact')}
                >
                  <GridIcon />
                </button>
                <button
                  type="button"
                  className="ve-library__view-btn"
                  data-testid="ve-lib-view-list"
                  aria-label={t('ve.lib.viewList')}
                  title={t('ve.lib.viewList')}
                  aria-pressed={density === 'list'}
                  onClick={() => densityStore.set('list')}
                >
                  <ListIcon />
                </button>
              </div>
              <select
                className="ve-library__filter"
                aria-label={t('ve.lib.filter')}
                data-testid="ve-lib-filter"
                value={category}
                onChange={(e) => changeCategory(e.target.value)}
              >
                <option value="all">All categories ({allCards.length})</option>
                {categories.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label} ({cat.count})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="ve-library__body">
        <p className="ve-library__hint">Adding to: {targetLabel}</p>

        {source === 'blocks' ? (
          <>
            {results.length === 0 && <p className="ve-library__empty">No elements match &quot;{query}&quot;.</p>}

            {!query.trim() && category === 'all' && favBlocks.length > 0 && (
              <Group id="favs" title={t('ve.lib.favourites')} collapsed={collapsed.includes('favs')} forceOpen={searching} onToggle={toggleGroup} className="ve-lib-recent" testId="ve-lib-favs">
                <div className="ve-library__grid">{favBlocks.map((b) => renderCard(b))}</div>
              </Group>
            )}
            {!query.trim() && category === 'all' && recentBlocks.length > 0 && (
              <Group id="recent" title={t('ve.lib.recent')} collapsed={collapsed.includes('recent')} forceOpen={searching} onToggle={toggleGroup} className="ve-lib-recent" testId="ve-lib-recent">
                <div className="ve-library__grid">{recentBlocks.map((b) => renderCard(b))}</div>
              </Group>
            )}

            {category === 'all' && globalMatches.length > 0 && (
              <Group id="global" title={t('ve.lib.global')} collapsed={collapsed.includes('global')} forceOpen={searching} onToggle={toggleGroup} testId="ve-lib-globals">
                <div className="ve-library__grid">
                  {globalMatches.map((g) => (
                    <Tooltip text={`${g.name}: ${g.description || t('tip.editsGlobalSection')}`} key={g.id}><div
                      role="button"
                      tabIndex={0}
                      className="ve-library__card"
                      onClick={() => onPickTemplate([globalNode(g.id)])}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onPickTemplate([globalNode(g.id)])
                        }
                      }}
                      aria-label={g.name}
                    >
                      <span className="ve-library__card-icon">{String.fromCodePoint(0x1f310)}</span>
                      <span className="ve-library__card-label">{g.name}</span>
                      {density === 'list' && g.description && <span className="ve-library__card-desc">{g.description}</span>}
                    </div></Tooltip>
                  ))}
                </div>
              </Group>
            )}

            {FORM_PRESET_INSERT_READY && !formMode && category === 'all' && formCards.length > 0 && (
              <Group id="forms" title={t('ve.lib.forms')} collapsed={collapsed.includes('forms')} forceOpen={searching} onToggle={toggleGroup} testId="ve-lib-forms">
                {formNotice && (
                  <p className="ve-library__empty" role="alert">
                    {formNotice}
                  </p>
                )}
                <div className="ve-library__grid">
                  {formCards.map((f) => {
                    const insert = async () => {
                      if (formBusy) return
                      setFormBusy(true)
                      setFormNotice(null)
                      const result = await createFormFromPreset(f.id)
                      setFormBusy(false)
                      if ('node' in result) onPickTemplate([result.node])
                      else setFormNotice(result.error)
                    }
                    return (
                      <Tooltip text={`${f.label}: ${f.description}`} key={f.id}><div
                        role="button"
                        tabIndex={0}
                        className="ve-library__card"
                        onClick={() => void insert()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            void insert()
                          }
                        }}
                        aria-label={f.label}
                      >
                        <span className="ve-library__card-icon">{String.fromCodePoint(0x1f4dd)}</span>
                        <span className="ve-library__card-label">{f.label}</span>
                        {density === 'list' && <span className="ve-library__card-desc">{f.description}</span>}
                      </div></Tooltip>
                    )
                  })}
                </div>
              </Group>
            )}

            {!formMode && category === 'all' && shopCards.length > 0 && (
              <Group id="shop" title={t('ve.lib.shop')} collapsed={collapsed.includes('shop')} forceOpen={searching} onToggle={toggleGroup} testId="ve-lib-shop">
                <div className="ve-library__grid">
                  {shopCards.map((c) => (
                    <Tooltip text={`${c.label}: ${c.description}`} key={c.id}><div
                      role="button"
                      tabIndex={0}
                      className="ve-library__card"
                      onClick={() => onPickTemplate([commercePresetNode(c.id)!])}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onPickTemplate([commercePresetNode(c.id)!])
                        }
                      }}
                      aria-label={c.label}
                    >
                      <span className="ve-library__card-icon">{String.fromCodePoint(0x1f6d2)}</span>
                      <span className="ve-library__card-label">{c.label}</span>
                      {density === 'list' && <span className="ve-library__card-desc">{c.description}</span>}
                    </div></Tooltip>
                  ))}
                </div>
              </Group>
            )}

            {/* Searching: one flat list, best match first. Otherwise grouped by (merged) category. */}
            {query.trim() && results.length > 0 && (
              <div className="ve-library__group">
                <div className="ve-library__grid">{results.map((block) => renderCard(block))}</div>
              </div>
            )}
            {!query.trim() &&
              categories.map((cat) => {
                const blocks = results.filter((b) => cat.keys.includes(b.category))
                if (blocks.length === 0) return null
                return (
                  <Group key={cat.key} id={`cat-${cat.key}`} title={cat.label} collapsed={collapsed.includes(`cat-${cat.key}`)} forceOpen={searching} onToggle={toggleGroup}>
                    <div className="ve-library__grid">{blocks.map((block) => renderCard(block))}</div>
                  </Group>
                )
              })}
          </>
        ) : (
          <TemplateBrowser onPickTemplate={onPickTemplate} />
        )}
      </div>
    </div>
  )
}
