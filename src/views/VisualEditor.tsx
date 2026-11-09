'use client'
import { useAdminRoot } from '@/admin/adminRoute/AdminRouteProvider'
import { adminCollectionPath } from '@/admin/adminPaths'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { SectionColumn, SectionNode } from '@/lib/sectionTree'
import { defaultColumns } from '@/lib/sectionTree'

import { getElementDef } from '@/lib/elements/registry'
import { can } from '@/features/roles/permissions'

import { getBlockDef, INNER_SECTION_SLUG } from './visualEditor/blockSchemas'
import { applyPaddingDrag, canDragPadding } from './visualEditor/paddingDrag'
import { CANVAS_ORIGIN, isBridgeMessage, isColumnOpMessage, isColumnWidthsMessage, isPaddingMessage, isRenameColumnMessage, type ColumnOp, type FrameToParentMessage } from './visualEditor/canvasBridge'
import { applyColumnOp, applyColumnWidths, buildSectionNode, getColumn, getColumnOwner, isColumnPath, updateColumnAt, type ColumnDevice, type Structure } from './visualEditor/columnOps'
import { ColumnPanel } from './visualEditor/ColumnPanel'
import { StructurePicker } from './visualEditor/StructurePicker'
import { EditorDock, type DockTab } from './visualEditor/EditorDock'
import { flattenNavigatorNames, NavigatorPanel, type SelectMods } from './visualEditor/NavigatorPanel'
import { MultiSelectPanel } from './visualEditor/MultiSelectPanel'
import { deleteNodes, duplicateNodes, nodesForCopy, pasteStyleToNodes, rangeInContainer, splitLocked, toggleInSelection, topLevelPaths } from './visualEditor/multiSelect'
import { FinderPalette } from './visualEditor/FinderPalette'
import { commandEntries, nodeEntries, pageEditorHref, type FinderCommandId, type FinderEntry } from './visualEditor/finder'
import {
  cloneNode,
  getList,
  getNode,
  insertNode,
  insertNodes,
  moveNode,
  movedNodePath,
  pathKey,
  reorderWithin,
  splitPath,
  stripEditorIds,
  uniquifyAnchors,
  updateNode,
  type NodePath,
} from './visualEditor/treeOps'
import type { BlockContext } from '@/lib/blockContext'
import { PreviewAsPicker } from './visualEditor/PreviewAsPicker'
import { VISUAL_EDITOR_SURFACES } from './visualEditor/surfaces'
import { normaliseFormConfig } from '@/features/forms/config'
import { hasUnpublishedChanges as formHasUnpublishedChanges, upgradeFieldsToLayout, walkLayout } from '@/features/forms/layout'
import type { FormConfig } from '@/features/forms/types'
import { FormEditorContext } from './visualEditor/formInputs'
import { FormSettingsPanel } from './visualEditor/FormSettingsPanel'
import { FormBlockFieldsPanel } from './visualEditor/FormBlockFieldsPanel'
import { formEditorPath } from './visualEditor/formRelation'
import { PageSettingsPanel } from './visualEditor/PageSettingsPanel'
import { TranslationBar, TRANSLATION_BAR_CSS } from './visualEditor/TranslationBar'
import { TranslateBanner, TRANSLATE_BANNER_CSS } from './visualEditor/TranslateBanner'
import { TranslateActions, TRANSLATE_ACTIONS_CSS } from './visualEditor/TranslateActions'
import {
  blockMarks,
  fieldPathForElementText,
  firstFieldOfBlock,
  nextUntranslatedField,
  textCellsFor,
  translatedBlocks,
  type CanvasTextCell,
} from './visualEditor/translateCanvas'
import { saveCellText } from './visualEditor/translateApi'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { blockKeyFor } from '@/features/multilingual/blockText'
import { TranslatePanel, TRANSLATE_PANEL_CSS } from './visualEditor/TranslatePanel'
import { resolveTranslateParams } from './visualEditor/translateParams'
import type { DocumentTranslations } from '@/features/multilingual/documentTranslations'
import { translatableSource } from '@/features/multilingual/translatableFields'
import { localeLabel } from '@/features/multilingual/locales'
import { pageAvailability, pageSettingsPatch, readPageSettings, validatePageSettings, type PageSettings } from './visualEditor/pageSettings'
import { SaveAsTemplateDialog } from './visualEditor/SaveAsTemplate'
import { VISUAL_EDITOR_CSS } from './visualEditor/visualEditor.styles'
import { NAVIGATOR_CSS } from './visualEditor/navigator.styles'
import { HISTORY_PANEL_CSS } from './visualEditor/historyPanel.styles'
import { revisionsUrl, type RevisionRow } from './visualEditor/revisions'
import { useRevisions } from './visualEditor/useRevisions'
import { canRedo, canUndo, clampPath, createHistory, historyRows, jumpHistory, pushHistory, redoHistory, undoHistory, type History, type HistoryRow } from './visualEditor/history'
import { HistoryPanel } from './visualEditor/HistoryPanel'
import { applyPastedStyle, resetStyleKeepingAnchor, planPaste, readClipboard, readStyleClipboard, serializeNodes, serializeSelection, serializeStyle, withFreshIds, writeClipboard, writeStyleClipboard } from './visualEditor/editorClipboard'
import type { BlockStyle } from '@/lib/blockStyle'
import { ImportExportModal } from './visualEditor/ImportExportModal'
import { IMPORT_EXPORT_CSS } from './visualEditor/importExport.styles'
import { AI_BUILDER_CSS } from './visualEditor/aiBuilder.styles'
import { collectSubtree } from './visualEditor/aiBuilderState'
import { useEditorShortcuts } from './visualEditor/useEditorShortcuts'
import { ContextMenu, type ContextMenuItem } from './visualEditor/ContextMenu'
import { ShortcutsHelp } from './visualEditor/ShortcutsHelp'
import { SaveStatusChip } from './visualEditor/SaveStatusChip'
import { EditLockBanner } from '@/admin/views/EditLockBanner'
import { savedByAnotherSince, updatedAtFromSave } from './visualEditor/saveConflict'
import { CoachMarks, coachMarksSeen } from './visualEditor/CoachMarks'
import { isDirtyAfterRestore } from './visualEditor/dirtyState'
import { TopBarMore, useCompactTopBar } from './visualEditor/TopBarMore'
import './visualEditor/topbar.css'
import './visualEditor/veShell.css'
import { blockDraftKey, clearBlockDraft, comparableTree, draftNeedsOffer, readBlockDraft, writeBlockDraft, type BlockDraft } from './visualEditor/blockDraft'
import { clientToFrame, createDragFallback, currentLibraryDrag, endLibraryDrag, isLibraryDragTypes, readLibraryDrag, resolveDropSlotInDoc, trackLibraryDrag, type DropSlot, type LibraryDragPayload } from './visualEditor/dropSlot'

let idCounter = 0
const nextId = () => `ve-${Date.now()}-${idCounter++}`

function parsePath(): { mode: 'collection' | 'global'; slug: string; id?: string } | null {
  if (typeof window === 'undefined') return null
  const match = window.location.pathname.match(/\/visual-editor\/(collection|global)\/([^\/]+)(?:\/([^\/]+))?/)
  if (!match) return null
  return { mode: match[1] as 'collection' | 'global', slug: match[2], id: match[3] }
}

/** Gives every node in a loaded tree a stable client id for selection and keys. */
function withIds(nodes: SectionNode[]): SectionNode[] {
  return nodes.map((node) => {
    const next: SectionNode = { ...node, _id: node._id || nextId() }
    if (node.blockType === 'section' && Array.isArray(node.columns)) {
      next.columns = node.columns.map((column) => ({
        ...column,
        _id: column._id || nextId(),
        blocks: withIds(column.blocks || []),
      }))
    }
    return next
  })
}

import { copyNodeLocks, nodeKey, pairLockKeys, parseLocks, serializeLocks, type LockEntry, type Locks, type LockUser } from '@/features/roles/locks'
import { applyInlineEdit, inlineCandidate } from './visualEditor/inlineEdit'
import { canInsertInto, effectiveLock, lockedKeySet, lockKeyOf, lockMapForCanvas, withNodeLock } from './visualEditor/lockState'
import { canConvertLegacy, convertLegacyBlock } from './visualEditor/convertLegacy'
import type { LockUi } from './visualEditor/LockControls'
import { Tooltip } from '@/components/admin/shared/Tooltip'
import { useHydrated } from '@/lib/clientStore'

type TranslationPayload = DocumentTranslations & { title: string; users: { id: number; label: string }[] }
type TranslationResponse = (TranslationPayload & { enabled?: boolean }) | null
/** The signed-in user as /api/users/me returns it. */
type MeUser = LockUser & NonNullable<Parameters<typeof can>[0]>

/** Name of a node's type for the History panel ("Heading", "Section"). */
function typeLabel(node: { blockType?: string; elementType?: string } | null | undefined): string {
  if (!node?.blockType) return 'block'
  if (node.blockType === 'element' && node.elementType) {
    const elementDef = getElementDef(node.elementType)
    if (elementDef) return elementDef.label
  }
  return getBlockDef(node.blockType)?.label ?? node.blockType
}

export const VisualEditorView: React.FC = () => {
  // The URL is read once hydrated so the server render and first client render match (no window on the server).
  const routeReady = useHydrated()
  const route = useMemo(() => (routeReady ? parsePath() : null), [routeReady])
  const surface = route ? VISUAL_EDITOR_SURFACES[route.slug] : undefined
  const unknownTarget = routeReady && !(route && surface)

  const [loadingState, setLoading] = useState(true)
  const [errorState, setError] = useState<string | null>(null)
  const loading = loadingState && !unknownTarget
  const error = errorState ?? (unknownTarget ? 'Unknown editor target.' : null)
  // Navigator is client-only; the default matches the server render.
  const modLabel = routeReady && /Mac|iPhone|iPad/i.test(navigator.platform || '') ? 'Cmd' : 'Ctrl'
  const [blocks, setBlocks] = useState<SectionNode[]>([])
  const [docTitle, setDocTitle] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<NodePath | null>(null)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'publishing' | 'published' | 'error'>('idle')
  /** When the last successful save (draft or publish) finished; feeds the save status chip. */
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  // First-use tips open on their own once the editor has loaded, unless this browser already saw them
  // (read once hydrated, so the server render and first client render stay identical). The help menu can reopen them.
  const [tourRequested, setTourOpen] = useState(false)
  const [tourDismissed, setTourDismissed] = useState(false)
  const tourOpen = tourRequested || (routeReady && !tourDismissed && !coachMarksSeen())
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [templateKind, setTemplateKind] = useState<unknown>(null)
  const [previewCtx, setPreviewCtx] = useState<BlockContext | null>(null)
  const [dockTab, setDockTab] = useState<DockTab>('elements')
  // Revisions are only requested once the History tab has been opened, and reloaded after each save.
  const [historySeen, setHistorySeen] = useState(false)
  const [revisionsKey, setRevisionsKey] = useState(0)
  const showDockTab = useCallback((tab: DockTab) => {
    if (tab === 'history') setHistorySeen(true)
    setDockTab(tab)
  }, [])
  const [userPermissions, setUserPermissions] = useState<{ canEditStyle: boolean; canEditLayout: boolean } | null>(null)
  // Where the next element/template pick lands. Always defined (unlike the
  // old popup's open/closed state) since the dock is always visible now -
  // defaults to the end of the page until a specific "+" sets it.
  const [insertTarget, setInsertTarget] = useState<{ containerPath: NodePath; at: number }>({
    containerPath: [],
    at: 0,
  })
  const [dockCollapsed, setDockCollapsed] = useState(false)
  /** Where a "Select your structure" pick will insert the new section; null while the picker is closed. */
  const [structureTarget, setStructureTarget] = useState<{ containerPath: NodePath; at: number } | null>(null)
  const [dirty, setDirty] = useState(false)
  /** Narrow viewport: Import / Export and Save as template move into the top bar's More menu. */
  const compactBar = useCompactTopBar()
  /** Locks, page settings or form config changed since the last save (tree changes are judged against savedTreeRef instead). */
  const extraDirtyRef = useRef(false)
  /** Another user holds the edit lock on this document (and this user has not taken it over): saving is off. */
  const [lockedByOther, setLockedByOther] = useState(false)
  /** The document's updatedAt as of load / our last save; save() compares it with the server's before it writes. */
  const loadedUpdatedAtRef = useRef<string | null>(null)
  // Local draft recovery: an unsaved copy of the tree kept in this browser. Offered back on the next open, never applied on its own.
  const [draftOffer, setDraftOffer] = useState<BlockDraft | null>(null)
  const draftKeyRef = useRef<string | null>(null)
  /** The saved tree as comparableTree() sees it, or null before the document has loaded. */
  const savedTreeRef = useRef<string | null>(null)
  const offerPendingRef = useRef(false)
  const [locks, setLocks] = useState<Locks>({ nodes: {} })
  const [locksDirty, setLocksDirty] = useState(false)
  const [lockUser, setLockUser] = useState<(LockUser & { canManageLocks?: boolean }) | null>(null)
  const [roleChoices, setRoleChoices] = useState<string[]>(['editor', 'viewer'])
  const [lockNotice, setLockNotice] = useState<string | null>(null)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [finderOpen, setFinderOpen] = useState(false)
  const [templateToast, setTemplateToast] = useState<string | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  // Form builder state (only used when the surface is the Forms collection).
  const [formConfig, setFormConfig] = useState<FormConfig>(() => normaliseFormConfig(null))
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft')
  const [embedKey, setEmbedKey] = useState<string | undefined>(undefined)
  const [publishedLayout, setPublishedLayout] = useState<unknown>(null)
  const formMode = surface?.formMode === true
  // Page-level settings (title/slug/status/SEO): edited in the Settings tab, saved in the same PATCH.
  const [pageSettings, setPageSettings] = useState<PageSettings | null>(null)
  /** What the public address needs from the page document (see openPreview). */
  const pageLinkInfo = useRef<{ isHomepage: boolean; parent: unknown } | null>(null)
  // Translate mode: the document's translations (null when multilingual is off or the collection has none),
  // and the language being edited (null = the default language, the normal builder).
  const [translation, setTranslation] = useState<TranslationPayload | null>(null)
  const [editLocale, setEditLocale] = useState<string | null>(null)
  // The canvas's view of the translations while translating: the field the panel should show (a click on the
  // page), and the text typed but not yet saved, so the canvas reads in it live.
  const [focusField, setFocusField] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const t = useAdminT()
  const [pageInitial, setPageInitial] = useState<PageSettings | null>(null)
  const [pageAvail, setPageAvail] = useState(() => pageAvailability(null))
  const [navigatorExpandedState, setNavigatorExpandedState] = useState<Record<string, boolean>>({})

  const [menu, setMenu] = useState<{ x: number; y: number; path: NodePath } | null>(null)
  const [hasStyleClipboard, setHasStyleClipboard] = useState(false)

  // Undo/redo. The history lives in a ref (it changes on every edit); `historyTick` re-renders
  // the toolbar buttons when it does. blocksRef/selectedRef always hold the latest values so
  // several edits in one event still chain correctly.
  const historyRef = useRef<History>(createHistory())
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false })
  /** What the History panel lists; rebuilt whenever the history changes. */
  const [historyList, setHistoryList] = useState<HistoryRow[]>(() => historyRows(createHistory()))
  const syncHistory = useCallback(() => {
    setHistoryFlags({ undo: canUndo(historyRef.current), redo: canRedo(historyRef.current) })
    setHistoryList(historyRows(historyRef.current))
  }, [])
  const handleKeyRef = useRef<(k: { key: string; ctrl: boolean; meta: boolean; shift: boolean; alt: boolean }) => boolean>(() => false)
  const blocksRef = useRef<SectionNode[]>([])
  const selectedRef = useRef<NodePath | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const lastHoverKey = useRef<string | null>(null)

  const apiUrl = useMemo(() => {
    if (!route || !surface) return null
    return surface.kind === 'global' ? `/api/globals/${surface.slug}` : `/api/${surface.slug}/${route.id}`
  }, [route, surface])

  // Local draft recovery: the storage key follows the document; autosave every few seconds while the tree differs from the saved one.
  useEffect(() => {
    draftKeyRef.current = surface && route ? blockDraftKey(surface.slug, route.id, window.location.origin) : null
  }, [surface, route])
  useEffect(() => {
    offerPendingRef.current = draftOffer !== null
  }, [draftOffer])
  useEffect(() => {
    let lastWritten: string | null = null
    const timer = window.setInterval(() => {
      const key = draftKeyRef.current
      const saved = savedTreeRef.current
      // Do not overwrite the draft that is waiting for an answer, and do nothing before the document has loaded.
      if (!key || saved === null || offerPendingRef.current) return
      const current = blocksRef.current
      const tree = comparableTree(current)
      if (tree === saved) {
        if (lastWritten !== null) clearBlockDraft(key)
        lastWritten = null
      } else if (tree !== lastWritten) {
        if (writeBlockDraft(key, current, Date.now())) lastWritten = tree
      }
    }, 2500)
    return () => window.clearInterval(timer)
  }, [])

  // Fetch document and user permissions
  useEffect(() => {
    if (!apiUrl || !surface) return
    Promise.all([
      fetch(`${apiUrl}?depth=0`, { credentials: 'include' }).then((r): Promise<Record<string, unknown> | null> => (r.ok ? r.json() : null)),
      fetch('/api/users/me', { credentials: 'include' })
        .then((r): Promise<{ user?: MeUser | null } | null> => (r.ok ? r.json() : null))
        .then((r) => r?.user ?? null),
    ])
      .then(([doc, user]) => {
        if (doc && typeof doc === 'object') {
          let raw = (doc[surface.blocksField] as SectionNode[] | undefined) || []
          if (surface.formMode) {
            // A form made before the visual builder has only a flat field list: show it as a layout. Nothing is
            // written back until the person saves, and the upgrade gives the same tree every time.
            if (!Array.isArray(raw) || raw.length === 0) raw = upgradeFieldsToLayout(doc.fields) as unknown as SectionNode[]
            setFormConfig(normaliseFormConfig(doc.formConfig))
            setFormStatus(doc.formStatus === 'draft' ? 'draft' : 'published')
            setEmbedKey(typeof doc.embedKey === 'string' ? doc.embedKey : undefined)
            setPublishedLayout(doc.publishedLayout ?? null)
          }
          const withStableIds = withIds(raw)
          blocksRef.current = withStableIds
          historyRef.current = createHistory()
          setHistoryFlags({ undo: false, redo: false })
          setHistoryList(historyRows(historyRef.current))
          setBlocks(withStableIds)
          savedTreeRef.current = comparableTree(withStableIds)
          loadedUpdatedAtRef.current = typeof doc.updatedAt === 'string' ? doc.updatedAt : null
          const key = draftKeyRef.current
          const stored = key ? readBlockDraft(key) : null
          if (key && stored && draftNeedsOffer(stored, withStableIds, doc.updatedAt as string | undefined)) setDraftOffer(stored)
          else if (key && stored) clearBlockDraft(key)
          setInsertTarget({ containerPath: [], at: withStableIds.length })
          setDocTitle(surface.titleField ? String(doc[surface.titleField] || 'Untitled') : surface.label)
          setStatus(surface.formMode ? (doc.formStatus === 'draft' ? 'draft' : 'published') : (doc._status as string) || null)
          setLocks(parseLocks(doc.locks))
          setTemplateKind(surface.slug === 'site-templates' ? doc.kind : null)
          if (surface.kind === 'collection' && !surface.formMode) {
            const loaded = readPageSettings(doc)
            setPageSettings(loaded)
            setPageInitial(loaded)
            setPageAvail(pageAvailability(doc))
            pageLinkInfo.current = { isHomepage: doc.isHomepage === true, parent: doc.parent }
          }
        }
        if (user) {
          setLockUser({ ...user, canManageLocks: can(user, 'locks', 'update') })
          setUserPermissions({
            canEditStyle: can(user, 'content.editStyle', 'update'),
            canEditLayout: can(user, 'content.editLayout', 'update'),
          })
        }
        setLoading(false)
      })
      .catch((err) => {
        setError(String((err as Error)?.message || err))
        setLoading(false)
      })
  }, [apiUrl, surface])

  const appliedTranslateParams = useRef(false)
  const surfaceSlug = surface?.slug
  const surfaceKind = surface?.kind
  const routeId = route?.id
  const loadTranslations = useCallback(() => {
    if (surfaceKind !== 'collection' || !surfaceSlug || !routeId || !translatableSource(surfaceSlug)) return
    fetch(`/api/admin-translations?collection=${encodeURIComponent(surfaceSlug)}&id=${encodeURIComponent(routeId)}`, { credentials: 'include' })
      .then((r): Promise<TranslationResponse> => (r.ok ? r.json() : null))
      .then((data) => {
        setDrafts({})
        setTranslation(data?.enabled ? data : null)
        // Deep link from the Translations table: ?lang=<locale>&translate=1 opens the page in that language.
        // Applied once, when the document's translations first load, so a later reload does not reset the choice.
        if (data?.enabled && !appliedTranslateParams.current) {
          appliedTranslateParams.current = true
          const deepLink = resolveTranslateParams(
            window.location.search,
            data.locales.map((group) => group.locale),
            data.defaultLocale,
          )
          if (deepLink.locale) setEditLocale(deepLink.locale)
        }
      })
      .catch(() => setTranslation(null))
  }, [surfaceKind, surfaceSlug, routeId])
  useEffect(() => {
    loadTranslations()
  }, [loadTranslations])

  useEffect(() => {
    fetch('/api/roles?depth=0&limit=100', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { docs?: Array<{ slug?: unknown }> } | null) => {
        const slugs = (res?.docs ?? []).map((d) => d.slug).filter((x: unknown): x is string => typeof x === 'string' && x !== 'admin' && x !== 'customer')
        if (slugs.length) setRoleChoices(Array.from(new Set(['editor', 'viewer', ...slugs])))
      })
      .catch(() => {})
  }, [])

  // Warns before a tab close/refresh discards unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const selectedNode = selectedPath ? getNode(blocks, selectedPath) : undefined
  // Multi-selection (blocks only). It is tied to the tree it was made on, so any edit, undo or redo
  // drops it, and it only counts while the primary selection is one of its members.
  const [multi, setMulti] = useState<{ paths: NodePath[]; blocks: SectionNode[] } | null>(null)
  const multiPaths = useMemo<NodePath[]>(() => {
    if (!multi || multi.blocks !== blocks || multi.paths.length < 2 || !selectedPath) return []
    const key = pathKey(selectedPath)
    return multi.paths.some((p) => pathKey(p) === key) ? multi.paths : []
  }, [multi, blocks, selectedPath])
  const multiRef = useRef<NodePath[]>([])
  const toggleMultiRef = useRef<(path: NodePath) => void>(() => undefined)
  useEffect(() => {
    multiRef.current = multiPaths
  }, [multiPaths])
  // A Form block on a page: the form it points at (id or {id}) gets its fields panel in the Settings tab.
  const selectedFormRef = (() => {
    if (formMode || selectedNode?.blockType !== 'form') return undefined
    const ref = (selectedNode as { form?: unknown }).form
    const id = ref && typeof ref === 'object' ? (ref as { id?: unknown }).id : ref
    return (typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id !== '') ? id : undefined
  })()
  useEffect(() => {
    selectedRef.current = selectedPath
  }, [selectedPath])

  // Translate mode: while a non-default language is edited, the canvas shows the page in that language (a display
  // copy; the saved tree is never changed by it), the structure is locked, and text is edited in the translations.
  // See translateCanvas.ts for the rules; the refs below let the memoised callbacks read the current state.
  const blocksField = surface?.blocksField ?? 'blocks'
  const translating = Boolean(translation && editLocale)
  const cells = useMemo<CanvasTextCell[]>(
    () => (translation && editLocale ? textCellsFor(translation, editLocale, drafts) : []),
    [translation, editLocale, drafts],
  )
  const canvasBlocks = useMemo(() => (translating ? translatedBlocks(blocks, cells, blocksField) : blocks), [translating, blocks, cells, blocksField])
  const canvasMarks = useMemo(() => (translating ? blockMarks(blocks, cells) : {}), [translating, blocks, cells])
  const lockedText = t('builder.translate.locked')
  const translateRef = useRef({
    translating,
    cells,
    blocks,
    blocksField,
    focusField,
    lockedText,
    locale: editLocale ?? '',
    sourceId: translation?.sourceId ?? '',
  })
  useEffect(() => {
    translateRef.current = { translating, cells, blocks, blocksField, focusField, lockedText, locale: editLocale ?? '', sourceId: translation?.sourceId ?? '' }
  })
  /** A short message in the top toast slot. */
  const notifyTranslate = useCallback((text: string) => {
    setTemplateToast(text)
    setTimeout(() => setTemplateToast(null), 4000)
  }, [])
  const exitTranslate = useCallback(() => {
    setEditLocale(null)
    setFocusField(null)
  }, [])
  const navigateUntranslated = useCallback((direction: 1 | -1) => {
    const ctx = translateRef.current
    const next = nextUntranslatedField(ctx.cells, ctx.focusField, direction)
    if (next) setFocusField(next)
  }, [])
  /** A text edited on the canvas: saved as that field's translation, with the same rules as the panel. */
  const saveCanvasText = useCallback(
    (path: NodePath, field: string, value: string) => {
      const ctx = translateRef.current
      const node = getNode(ctx.blocks, path)
      if (!node) return
      const fieldPath = fieldPathForElementText(ctx.blocksField, blockKeyFor(node as unknown as Record<string, unknown>, path), field)
      const cell = ctx.cells.find((entry) => entry.fieldPath === fieldPath)
      if (!cell) {
        notifyTranslate(t('builder.translate.inPanel'))
        return
      }
      setDrafts((prev) => ({ ...prev, [fieldPath]: value }))
      saveCellText({ cell, locale: ctx.locale, sourceId: ctx.sourceId, value })
        .then(() => loadTranslations())
        .catch((error: Error) => {
          notifyTranslate(error.message)
          loadTranslations()
        })
    },
    [notifyTranslate, t, loadTranslations],
  )
  // Alt+Left / Alt+Right on the parent document step through the untranslated texts (the frame forwards them too).
  useEffect(() => {
    if (!translating) return
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
      event.preventDefault()
      navigateUntranslated(event.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [translating, navigateUntranslated])

  // Latest tree/locks/user for the mutation callbacks below (they are memoised without them).
  const lockCtx = useRef({ blocks, locks, lockUser, formConfig })
  useEffect(() => {
    lockCtx.current = { blocks, locks, lockUser, formConfig }
  }, [blocks, locks, lockUser, formConfig])
  /** True (and tells the person why) when a locked section stops this edit. */
  const lockedOut = useCallback((path: NodePath): boolean => {
    if (translateRef.current.translating) {
      setLockNotice(translateRef.current.lockedText)
      setTimeout(() => setLockNotice(null), 5000)
      return true
    }
    const { blocks: b, locks: l, lockUser: u } = lockCtx.current
    const lock = effectiveLock(b, path, l, u)
    if (lock?.blocked) {
      setLockNotice(`"${lock.label}" is locked. ${lock.unlockRoles.length ? `Roles that can unlock it: ${lock.unlockRoles.join(', ')}.` : 'Only an admin can unlock it.'}`)
      setTimeout(() => setLockNotice(null), 5000)
      return true
    }
    return false
  }, [])
  const insertBlocked = useCallback((containerPath: NodePath): boolean => {
    if (translateRef.current.translating) {
      setLockNotice(translateRef.current.lockedText)
      setTimeout(() => setLockNotice(null), 5000)
      return true
    }
    const { blocks: b, locks: l, lockUser: u } = lockCtx.current
    if (canInsertInto(b, containerPath, l, u)) return false
    setLockNotice('This part of the page is locked, so nothing can be added here.')
    setTimeout(() => setLockNotice(null), 5000)
    return true
  }, [])
  // For an `element` node, swap in the specific element's label/icon (from
  // the registry) so the panel header reads "Heading", not the generic
  // "Element" - the block def itself doesn't know which element it holds.
  const selectedDef = selectedNode
    ? (() => {
        const base = getBlockDef(selectedNode.blockType)
        if (!base || selectedNode.blockType !== 'element') return base
        const elementDef = getElementDef((selectedNode as { elementType?: string }).elementType || '')
        return elementDef ? { ...base, label: elementDef.label, icon: elementDef.icon } : base
      })()
    : undefined

  /* ---------------------------------------------------------------------- */
  /* Tree mutations                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * The one way the tree changes: records the old tree for undo, then applies the change.
   * `key` merges rapid repeat edits (typing in one field) into a single undo step.
   */
  const applyBlocks = useCallback((change: (prev: SectionNode[]) => SectionNode[], key?: string, label?: string) => {
    // Translate mode: the default language's structure and properties are read-only (text is edited in the translations).
    if (translateRef.current.translating) {
      setLockNotice(translateRef.current.lockedText)
      setTimeout(() => setLockNotice(null), 5000)
      return false
    }
    const prev = blocksRef.current
    const next = change(prev)
    if (next === prev) return false
    historyRef.current = pushHistory(historyRef.current, { blocks: prev, selectedPath: selectedRef.current }, { key, label })
    blocksRef.current = next
    setBlocks(next)
    syncHistory()
    setDirty(true)
    return true
  }, [syncHistory])

  /** Navigator: select a node exactly like a canvas click does. */
  const selectFromNavigator = useCallback((path: NodePath, mods?: SelectMods) => {
    if (mods?.additive && path.length % 2 === 1) {
      toggleMultiRef.current(path)
      return
    }
    if (mods?.range && path.length % 2 === 1) {
      const range = rangeInContainer(selectedRef.current, path)
      if (range.length > 1) {
        setMulti({ paths: range, blocks: blocksRef.current })
        setSelectedPath(path)
        return
      }
    }
    setMulti(null)
    setSelectedPath(path)
    if (isColumnPath(path)) {
      const column = getColumn(blocksRef.current, path)
      if (column) setInsertTarget({ containerPath: path, at: (column.blocks || []).length })
    }
  }, [setMulti])

  /** Navigator: editor-only name for a block (odd path) or column (even path). */
  const renameNode = useCallback((path: NodePath, name: string) => {
    const label = name.trim()
    applyBlocks((prev) =>
      path.length % 2 === 0
        ? updateColumnAt(prev, path, (c) => {
            const { label: _old, ...rest } = c
            return label ? { ...rest, label } : rest
          })
        : updateNode(prev, path, (n) => {
            const { label: _old, ...rest } = n
            return (label ? { ...rest, label } : rest) as SectionNode
          }),
      undefined,
      'Renamed',
    )
  }, [applyBlocks])

  /** Navigator: set the block's anchor id (element id, used by #jump links). */
  const setNodeAnchor = useCallback((path: NodePath, anchor: string) => {
    const set = (design: Record<string, unknown> | undefined) => {
      const { anchorId: _old, ...rest } = design || {}
      return (anchor ? { ...rest, anchorId: anchor } : rest) as typeof design
    }
    applyBlocks((prev) =>
      path.length % 2 === 0
        ? updateColumnAt(prev, path, (c) => ({ ...c, design: set(c.design as Record<string, unknown> | undefined) as typeof c.design }))
        : updateNode(prev, path, (n) => ({ ...n, design: set(n.design as Record<string, unknown> | undefined) as typeof n.design })),
      undefined,
      'CSS ID changed',
    )
  }, [applyBlocks])

  const restoreSnapshot = useCallback((snapshot: { blocks: SectionNode[]; selectedPath: NodePath | null }) => {
    blocksRef.current = snapshot.blocks
    setBlocks(snapshot.blocks)
    const nextPath = clampPath(snapshot.blocks, snapshot.selectedPath)
    selectedRef.current = nextPath
    setSelectedPath(nextPath)
    if (!nextPath) setDockTab('elements')
    setInsertTarget({ containerPath: [], at: snapshot.blocks.length })
    syncHistory()
    // Undoing back to the saved tree clears the dirty state (unless locks / page settings still differ).
    setDirty(isDirtyAfterRestore(snapshot.blocks, savedTreeRef.current, extraDirtyRef.current))
  }, [syncHistory])

  /** History panel: jump straight to a listed state (negative = back, positive = forward). */
  const jumpTo = useCallback((steps: number) => {
    if (translateRef.current.translating) return
    const result = jumpHistory(historyRef.current, { blocks: blocksRef.current, selectedPath: selectedRef.current }, steps)
    if (!result) return
    historyRef.current = result.history
    restoreSnapshot(result.snapshot)
  }, [restoreSnapshot])

  const revisions = useRevisions(surface && route ? revisionsUrl(surface.kind, surface.slug, route.id) : null, surface?.blocksField ?? '', historySeen, revisionsKey)

  const undo = useCallback(() => {
    if (translateRef.current.translating) return
    const result = undoHistory(historyRef.current, { blocks: blocksRef.current, selectedPath: selectedRef.current })
    if (!result) return
    historyRef.current = result.history
    restoreSnapshot(result.snapshot)
  }, [restoreSnapshot])

  const redo = useCallback(() => {
    if (translateRef.current.translating) return
    const result = redoHistory(historyRef.current, { blocks: blocksRef.current, selectedPath: selectedRef.current })
    if (!result) return
    historyRef.current = result.history
    restoreSnapshot(result.snapshot)
  }, [restoreSnapshot])

  /**
   * A fresh node for a block type - a brand-new section starts with two
   * columns so it is immediately useful.
   *
   * "element:<type>" is a synthetic slug, not a real block: the library shows
   * one card per src/lib/elements/registry.ts entry rather than one card for
   * the generic `element` block (which has nothing to edit until an
   * elementType is chosen) - see blockSchemas.ts's `element` entry.
   */
  const buildNode = useCallback((blockType: string): SectionNode | null => {
    if (blockType.startsWith('element:')) {
      const elementType = blockType.slice('element:'.length)
      const elementDef = getElementDef(elementType)
      if (!elementDef) return null
      return { blockType: 'element', elementType, props: elementDef.defaultProps(), _id: nextId() } as SectionNode
    }

    const def = getBlockDef(blockType)
    if (!def) return null
    const node: SectionNode = { ...(def.defaultValue() as SectionNode), _id: nextId() }
    if (blockType === 'section') node.columns = defaultColumns(2, nextId)
    return node
  }, [])

  /** Sections (and inner sections) ask for a structure first. Returns true when it took over the pick. */
  const requestSection = useCallback(
    (blockType: string, containerPath: NodePath, at: number): boolean => {
      if (blockType !== 'section' && blockType !== INNER_SECTION_SLUG) return false
      if (blockType === INNER_SECTION_SLUG && containerPath.length === 0) {
        setLockNotice('Select a column first (click an empty part of one on the canvas), then add an inner section.')
        setTimeout(() => setLockNotice(null), 5000)
        return true
      }
      if (insertBlocked(containerPath)) return true
      setStructureTarget({ containerPath, at })
      return true
    },
    [insertBlocked],
  )

  const addBlock = useCallback(
    (blockType: string) => {
      if (blockType === INNER_SECTION_SLUG) {
        // An inner section goes in the selected column (at its end), else wherever the last "+" pointed.
        const selected = selectedRef.current
        const column = isColumnPath(selected) ? getColumn(lockCtx.current.blocks, selected) : undefined
        if (selected && column) requestSection(blockType, selected, (column.blocks || []).length)
        else requestSection(blockType, insertTarget.containerPath, insertTarget.at)
        return
      }
      if (requestSection(blockType, insertTarget.containerPath, insertTarget.at)) return
      const node = buildNode(blockType)
      if (!node) return
      const { containerPath, at } = insertTarget
      if (insertBlocked(containerPath)) return

      applyBlocks((prev) => insertNode(prev, containerPath, at, node), undefined, `Added ${typeLabel(node)}`)
      setSelectedPath([...containerPath, at])
      setDockTab('settings')
    },
    [insertTarget, buildNode, insertBlocked, applyBlocks, requestSection],
  )

  /** Same as addBlock, but for a drag-and-drop from the library that already knows its own target. */
  const addBlockAt = useCallback(
    (blockType: string, containerPath: NodePath, at: number) => {
      if (requestSection(blockType, containerPath, at)) return
      const node = buildNode(blockType)
      if (!node) return
      if (insertBlocked(containerPath)) return

      applyBlocks((prev) => insertNode(prev, containerPath, at, node), undefined, `Added ${typeLabel(node)}`)
      setSelectedPath([...containerPath, at])
      setInsertTarget({ containerPath, at: at + 1 })
      setDockTab('settings')
    },
    [buildNode, insertBlocked, applyBlocks, requestSection],
  )

  /** Inserts the section the person configured in the structure picker. */
  const insertStructure = useCallback(
    (structure: Structure) => {
      const target = structureTarget
      setStructureTarget(null)
      if (!target || insertBlocked(target.containerPath)) return
      const node = buildSectionNode(structure.widths, nextId)
      applyBlocks((prev) => insertNode(prev, target.containerPath, target.at, node), undefined, 'Added Section')
      setSelectedPath([...target.containerPath, target.at])
      setInsertTarget({ containerPath: target.containerPath, at: target.at + 1 })
      setDockTab('settings')
    },
    [structureTarget, insertBlocked, applyBlocks],
  )

  /** Templates (a curated preset or a saved Page Template) insert several blocks at once. */
  const insertTemplateAt = useCallback(
    (templateBlocks: SectionNode[], containerPath: NodePath, at: number, templateLocks?: Locks, label = 'Template inserted') => {
      if (templateBlocks.length === 0) return
      if (insertBlocked(containerPath)) return
      const withFreshIds = templateBlocks.map((node) => cloneNode({ ...node, _id: undefined }, nextId))

      applyBlocks((prev) => insertNodes(prev, containerPath, at, uniquifyAnchors(prev, withFreshIds)), undefined, label)
      // The template's section locks go with its sections (only for someone who may set locks; the server checks too).
      if (templateLocks && lockUser?.canManageLocks && Object.keys(templateLocks.nodes).length > 0) {
        const pairs = pairLockKeys(templateBlocks, withFreshIds)
        setLocks((prev) => copyNodeLocks(templateLocks, pairs, prev))
      }
      setSelectedPath([...containerPath, at])
      setDockTab('settings')
    },
    [insertBlocked, applyBlocks, lockUser],
  )

  const addTemplateBlocks = useCallback(
    (templateBlocks: SectionNode[], templateLocks?: Locks) => insertTemplateAt(templateBlocks, insertTarget.containerPath, insertTarget.at, templateLocks),
    [insertTarget, insertTemplateAt],
  )

  const deleteBlock = useCallback((path: NodePath) => {
    if (lockedOut(path)) return
    applyBlocks((prev) => updateNode(prev, path, () => null), undefined, `Deleted ${typeLabel(getNode(blocksRef.current, path))}`)
    setSelectedPath(null)
  }, [lockedOut, applyBlocks])

  const duplicateBlock = useCallback((path: NodePath) => {
    if (lockedOut(path)) return
    const { containerPath, index } = splitPath(path)
    applyBlocks((prev) => {
      const original = getNode(prev, path)
      if (!original) return prev
      const [copy] = uniquifyAnchors(prev, [cloneNode(original, nextId)])
      return insertNode(prev, containerPath, index + 1, copy)
    }, undefined, 'Duplicated')
  }, [lockedOut, applyBlocks])

  const moveBlock = useCallback((path: NodePath, direction: -1 | 1) => {
    if (lockedOut(path)) return
    if (path.length % 2 === 0) return
    const { containerPath, index } = splitPath(path)
    const list = getList(blocksRef.current, containerPath)
    if (!list || index + direction < 0 || index + direction >= list.length) return
    applyBlocks((prev) => reorderWithin(prev, containerPath, index, index + direction), undefined, 'Moved')
    setSelectedPath([...containerPath, index + direction])
  }, [lockedOut, applyBlocks])

  const updateSelected = useCallback(
    (next: Record<string, unknown>) => {
      if (!selectedPath) return
      const lock = effectiveLock(lockCtx.current.blocks, selectedPath, lockCtx.current.locks, lockCtx.current.lockUser)
      if (lock?.blocked && lock.mode === 'full') return
      applyBlocks((prev) => updateNode(prev, selectedPath, (node) => ({ ...(next as SectionNode), _id: node._id })), `edit:${pathKey(selectedPath)}`, `Edited ${typeLabel(getNode(blocksRef.current, selectedPath))}`)
    },
    [selectedPath, applyBlocks],
  )

  /** Handle-drag drop: move a block into any list (same column, another column, out of/into sections). */
  const moveBlockTo = useCallback((from: NodePath, containerPath: NodePath, at: number) => {
    if (lockedOut(from) || insertBlocked(containerPath)) return
    const { blocks: current } = lockCtx.current
    const landed = movedNodePath(current, from, containerPath, at)
    if (!landed) return
    applyBlocks((prev) => moveNode(prev, from, containerPath, at), undefined, 'Moved')
    setSelectedPath(landed)
  }, [lockedOut, insertBlocked, applyBlocks])

  /** Column toolbar actions from the canvas or the column panel. */
  const columnOp = useCallback((path: NodePath, op: ColumnOp) => {
    if (!isColumnPath(path) || lockedOut(path.slice(0, -1))) return
    if (op === 'innerSection') {
      const column = getColumn(blocksRef.current, path)
      if (column) requestSection(INNER_SECTION_SLUG, path, (column.blocks || []).length)
      return
    }
    const result = applyColumnOp(blocksRef.current, path, op, nextId)
    if (!result) return
    applyBlocks(() => result.blocks, undefined, 'Column change')
    setSelectedPath(result.selectedPath)
    setDockTab('settings')
  }, [lockedOut, requestSection, applyBlocks])

  /** Edits from the column panel (one history step per burst of edits to the same column). */
  const updateSelectedColumn = useCallback((path: NodePath, column: SectionColumn) => {
    const lock = effectiveLock(lockCtx.current.blocks, path.slice(0, -1), lockCtx.current.locks, lockCtx.current.lockUser)
    if (lock?.blocked && lock.mode === 'full') return
    applyBlocks((prev) => updateColumnAt(prev, path, () => column), `column:${pathKey(path)}`, 'Column change')
  }, [applyBlocks])

  /** Canvas drag-resize of two neighbouring columns: one edit (one undo step) for the device shown. Same lock rule as the panel. */
  const setColumnWidths = useCallback((sectionPath: NodePath, widths: number[], target: ColumnDevice) => {
    const lock = effectiveLock(lockCtx.current.blocks, sectionPath, lockCtx.current.locks, lockCtx.current.lockUser)
    if (lock?.blocked && lock.mode === 'full') return
    applyBlocks((prev) => applyColumnWidths(prev, sectionPath, widths, target), undefined, 'Column change')
  }, [applyBlocks])

  /** Legacy block (hero, CTA banner, image + text, gallery) -> editable section tree, in place: one undo step, then the section is selected. */
  const convertSelectedLegacy = useCallback(() => {
    if (!selectedPath || selectedPath.length % 2 === 0) return
    if (lockedOut(selectedPath)) return
    const current = getNode(blocksRef.current, selectedPath)
    if (!current || !canConvertLegacy(current.blockType)) return
    const converted = convertLegacyBlock(current as Record<string, unknown>)
    if (!converted) return
    const [fresh] = withFreshIds([converted as SectionNode], nextId)
    // Keep the replaced block's id so a lock on it stays attached to the new section.
    const section: SectionNode = current._id ? { ...fresh, _id: current._id } : fresh
    applyBlocks((prev) => updateNode(prev, selectedPath, () => section), undefined, 'Converted to section')
    setSelectedPath(selectedPath)
    setDockTab('settings')
  }, [selectedPath, lockedOut, applyBlocks])

  /* ---------------------------------------------------------------------- */
  /* Clipboard                                                               */
  /* ---------------------------------------------------------------------- */

  const flashNotice = useCallback((text: string, ms = 4000) => {
    setTemplateToast(text)
    setTimeout(() => setTemplateToast(null), ms)
  }, [])

  /** Canvas drag of a section's top / bottom padding bar: one undo step, written for the device shown. Same rules as the Design panel. */
  const setPadding = useCallback((path: NodePath, side: 'top' | 'bottom', value: number, target: 'desktop' | 'tablet' | 'mobile') => {
    if (!userPermissions?.canEditStyle) {
      flashNotice('Your role cannot edit styles.')
      return
    }
    if (lockedOut(path)) return
    const node = getNode(lockCtx.current.blocks, path)
    if (!node || !canDragPadding(node.design as { paddingUnit?: unknown } | undefined)) return
    applyBlocks((prev) => updateNode(prev, path, (n) => ({ ...n, design: applyPaddingDrag(n.design, side, value, target) })), `pad:${pathKey(path)}`, 'Padding changed')
  }, [userPermissions, lockedOut, flashNotice, applyBlocks])

  /** Revisions tab: puts a saved version's content on the canvas as one undoable edit. Nothing is saved until Save. */
  const applyRevision = useCallback((revision: RevisionRow) => {
    if (!Array.isArray(revision.blocks)) {
      flashNotice(t('ve.revisions.noContent'))
      return
    }
    if (insertBlocked([])) return
    if (Object.keys(lockCtx.current.locks.nodes).length > 0) {
      setLockNotice(t('ve.revisions.locked'))
      setTimeout(() => setLockNotice(null), 5000)
      return
    }
    const fresh = withIds(revision.blocks as SectionNode[])
    if (applyBlocks(() => fresh, undefined, 'Revision restored')) {
      setSelectedPath(null)
      setInsertTarget({ containerPath: [], at: fresh.length })
      flashNotice(t('ve.revisions.applied'), 2500)
    }
  }, [applyBlocks, insertBlocked, flashNotice, t])

  /* Import / Export: same insert and lock rules as paste; replace goes through applyBlocks so undo restores it. */
  const closeImport = useCallback(() => setImportOpen(false), [])
  const importAppend = useCallback(
    (nodes: SectionNode[]): boolean => {
      if (insertBlocked([])) return false
      insertTemplateAt(nodes, [], blocksRef.current.length, undefined, 'Imported')
      flashNotice(`Imported ${nodes.length} top-level ${nodes.length === 1 ? 'block' : 'blocks'}`, 2500)
      return true
    },
    [insertBlocked, insertTemplateAt, flashNotice],
  )
  const importReplace = useCallback(
    (nodes: SectionNode[]): boolean => {
      if (insertBlocked([])) return false
      if (Object.keys(lockCtx.current.locks.nodes).length > 0) {
        setLockNotice('This page has section locks, so it cannot be replaced. Append instead, or remove the locks first.')
        setTimeout(() => setLockNotice(null), 5000)
        return false
      }
      const fresh = withFreshIds(nodes, nextId)
      applyBlocks(() => fresh, undefined, 'Imported')
      setSelectedPath(null)
      setInsertTarget({ containerPath: [], at: fresh.length })
      flashNotice(`Replaced the page with ${fresh.length} top-level ${fresh.length === 1 ? 'block' : 'blocks'}`, 2500)
      return true
    },
    [insertBlocked, applyBlocks, flashNotice],
  )

  /* Build with AI: new sections go to the end of the page, same rules and one undo step as an import. */
  const aiInsertAtEnd = useCallback(
    (sections: SectionNode[]): boolean => {
      if (sections.length === 0 || insertBlocked([])) return false
      insertTemplateAt(sections, [], blocksRef.current.length, undefined, 'AI insert')
      flashNotice(`Added ${sections.length} ${sections.length === 1 ? 'section' : 'sections'} with AI`, 2500)
      return true
    },
    [insertBlocked, insertTemplateAt, flashNotice],
  )

  /* Build with AI, edit mode: swaps the selected top-level section for the generated ones (one undo step). */
  const aiReplaceSelected = useCallback(
    (sections: SectionNode[], sectionId: string | undefined): boolean => {
      const path = selectedRef.current
      if (!path || path.length !== 1 || sections.length === 0) return false
      const index = path[0]
      const current = blocksRef.current[index]
      if (!current || current._id !== sectionId) return false
      if (lockedOut(path)) return false
      const lockedKeys = lockedKeySet(lockCtx.current.locks)
      if (collectSubtree(current).some((node) => {
        const key = nodeKey(node)
        return key !== undefined && lockedKeys.has(key)
      })) {
        setLockNotice('This section has locked parts, so it cannot be replaced. Unlock them first.')
        setTimeout(() => setLockNotice(null), 5000)
        return false
      }
      const fresh = sections.map((node) => cloneNode({ ...node, _id: undefined }, nextId))
      applyBlocks((prev) => [...prev.slice(0, index), ...fresh, ...prev.slice(index + 1)], undefined, 'AI insert')
      setSelectedPath([index])
      setInsertTarget({ containerPath: [], at: index + 1 })
      flashNotice(`Replaced the section with ${fresh.length} ${fresh.length === 1 ? 'section' : 'sections'} from AI`, 2500)
      return true
    },
    [lockedOut, applyBlocks, flashNotice],
  )

  const aiSelectedSection =
    selectedPath && selectedPath.length === 1 && blocks[selectedPath[0]]?.blockType === 'section' ? blocks[selectedPath[0]] : null

  const copyNode = useCallback(async (path: NodePath): Promise<boolean> => {
    const serialized = serializeSelection(blocksRef.current, path)
    if (!serialized) return false
    const where = await writeClipboard(serialized.text)
    flashNotice(where === 'system' ? 'Copied' : 'Copied (kept inside the editor only; the browser blocked the clipboard)', 2500)
    return true
  }, [flashNotice])

  const cutNode = useCallback(async (path: NodePath) => {
    if (lockedOut(path)) return
    if (await copyNode(path)) deleteBlock(path)
  }, [lockedOut, copyNode, deleteBlock])

  const pasteAt = useCallback(async (target: NodePath | null) => {
    const result = await readClipboard()
    if (result.ok === false) {
      flashNotice(result.error)
      return
    }
    const { containerPath, at } = planPaste(blocksRef.current, target)
    insertTemplateAt(result.nodes, containerPath, at, undefined, 'Pasted')
  }, [flashNotice, insertTemplateAt])

  const copyStyle = useCallback(async (path: NodePath) => {
    const node = getNode(blocksRef.current, path)
    if (!node) return false
    const design = node.design || {}
    const serialized = serializeStyle(design, device)
    if (!serialized) return false
    const where = await writeStyleClipboard(serialized.text)
    setHasStyleClipboard(true)
    flashNotice(where === 'system' ? 'Style copied' : 'Style copied (kept inside the editor only)', 2500)
    return true
  }, [device, flashNotice])

  const pasteStyle = useCallback(async (path: NodePath | null) => {
    if (!path || path.length === 0) return
    if (!userPermissions?.canEditStyle) {
      flashNotice('Your role cannot edit styles.')
      return
    }
    if (lockedOut(path)) return
    const result = await readStyleClipboard()
    if (result.ok === false) {
      flashNotice(result.error)
      return
    }
    const source = result.design
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      flashNotice('The copied content has no design.')
      return
    }
    // Every breakpoint comes with the copied design; the clipboard device is not needed.
    const changed = applyBlocks((prev) =>
      updateNode(prev, path, (node) => ({ ...node, design: applyPastedStyle(node.design, source as BlockStyle) })),
      undefined,
      'Style pasted',
    )
    if (changed) flashNotice('Style pasted')
  }, [userPermissions, lockedOut, flashNotice, applyBlocks])

  /* ---------------------------------------------------------------------- */
  /* Multi-select bulk actions: each is one applyBlocks call (one undo step)  */
  /* ---------------------------------------------------------------------- */

  /** Ctrl/Cmd-click (canvas or Navigator): adds the block to the selection or removes it. A plain selection counts as the first member. */
  const toggleMulti = useCallback((path: NodePath) => {
    const sel = selectedRef.current
    const current = multiRef.current.length > 0 ? multiRef.current : sel && sel.length % 2 === 1 ? [sel] : []
    const next = toggleInSelection(current, path)
    setDockTab('settings')
    if (next.length === 0) {
      setMulti(null)
      setSelectedPath(null)
    } else if (next.length === 1) {
      setMulti(null)
      setSelectedPath(next[0])
    } else {
      setMulti({ paths: next, blocks: blocksRef.current })
      const stillIn = next.some((p) => pathKey(p) === pathKey(path))
      setSelectedPath(stillIn ? path : next[next.length - 1])
    }
  }, [setMulti])
  useEffect(() => {
    toggleMultiRef.current = toggleMulti
  }, [toggleMulti])

  /** The selected blocks a lock does not stop (top-level only); tells the person how many were skipped. */
  const editableMulti = useCallback((): NodePath[] => {
    const { allowed, skipped } = splitLocked(topLevelPaths(multiRef.current), (path) => {
      const lock = effectiveLock(lockCtx.current.blocks, path, lockCtx.current.locks, lockCtx.current.lockUser)
      return Boolean(lock?.blocked)
    })
    if (skipped.length > 0) {
      setLockNotice(t('ve.multi.skipped', { n: skipped.length }))
      setTimeout(() => setLockNotice(null), 5000)
    }
    return allowed
  }, [t])

  const deleteMulti = useCallback(() => {
    const paths = editableMulti()
    if (paths.length === 0) return
    const changed = applyBlocks((prev) => deleteNodes(prev, paths), undefined, `Deleted ${paths.length} elements`)
    if (changed) {
      setMulti(null)
      setSelectedPath(null)
    }
  }, [editableMulti, applyBlocks, setMulti])

  const duplicateMulti = useCallback(() => {
    const paths = editableMulti()
    if (paths.length === 0) return
    const changed = applyBlocks((prev) => duplicateNodes(prev, paths, nextId), undefined, `Duplicated ${paths.length} elements`)
    if (changed) setMulti(null)
  }, [editableMulti, applyBlocks, setMulti])

  /** Copies every selected block (locked ones too: copying changes nothing). Returns false when nothing was copied. */
  const copyMulti = useCallback(async (): Promise<boolean> => {
    const nodes = nodesForCopy(blocksRef.current, multiRef.current)
    const serialized = serializeNodes(nodes)
    if (!serialized) return false
    const where = await writeClipboard(serialized.text)
    flashNotice(where === 'system' ? t('ve.multi.copied', { n: serialized.count }) : 'Copied (kept inside the editor only; the browser blocked the clipboard)', 2500)
    return true
  }, [flashNotice, t])

  const cutMulti = useCallback(async () => {
    if (translateRef.current.translating) {
      setLockNotice(translateRef.current.lockedText)
      setTimeout(() => setLockNotice(null), 5000)
      return
    }
    if (await copyMulti()) deleteMulti()
  }, [copyMulti, deleteMulti])

  const pasteStyleMulti = useCallback(async () => {
    if (!userPermissions?.canEditStyle) {
      flashNotice('Your role cannot edit styles.')
      return
    }
    const paths = editableMulti()
    if (paths.length === 0) return
    const result = await readStyleClipboard()
    if (result.ok === false) {
      flashNotice(result.error)
      return
    }
    const source = result.design
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      flashNotice('The copied content has no design.')
      return
    }
    const changed = applyBlocks((prev) => pasteStyleToNodes(prev, paths, source as BlockStyle), undefined, 'Style pasted')
    if (changed) flashNotice('Style pasted')
  }, [userPermissions, editableMulti, flashNotice, applyBlocks])

  /** Context menu: drops the block's style but keeps its CSS id. One undo step. */
  const resetStyle = useCallback(
    (path: NodePath) => {
      if (!userPermissions?.canEditStyle) {
        flashNotice('Your role cannot edit styles.')
        return
      }
      if (lockedOut(path)) return
      const changed = applyBlocks((prev) => updateNode(prev, path, resetStyleKeepingAnchor), undefined, 'Style reset')
      if (changed) flashNotice('Style reset')
    },
    [userPermissions, lockedOut, flashNotice, applyBlocks],
  )

  // Check style clipboard when context menu opens
  useEffect(() => {
    if (!menu) return
    void (async () => {
      const result = await readStyleClipboard()
      setHasStyleClipboard(result.ok === true)
    })()
  }, [menu])

  /* ---------------------------------------------------------------------- */
  /* Canvas iframe bridge - see visualEditor/canvasBridge.ts                */
  /* ---------------------------------------------------------------------- */

  // Handles every request the canvas iframe sends up. The frame never
  // mutates its own copy of the tree for these (only local selection state) -
  // it waits for the "blocks"/"selected" push below, same as every other
  // consumer of this state.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      const data: unknown = event.data
      if (isColumnOpMessage(data)) {
        columnOp(data.path, data.op)
        return
      }
      if (isRenameColumnMessage(data)) {
        renameNode(data.path, data.label)
        return
      }
      if (isColumnWidthsMessage(data)) {
        setColumnWidths(data.path, data.widths, data.device)
        return
      }
      if (isPaddingMessage(data)) {
        setPadding(data.path, data.side, data.value, data.device)
        return
      }
      if (!isBridgeMessage(data)) return
      const msg = data as FrameToParentMessage
      switch (msg.type) {
        case 'ready':
          setFrameReady(true)
          break
        case 'select':
          if (msg.additive && Array.isArray(msg.path) && msg.path.length % 2 === 1) {
            toggleMulti(msg.path)
            break
          }
          setMulti(null)
          if (translateRef.current.translating && Array.isArray(msg.path) && msg.path.length % 2 === 1) {
            // A click on a block in translate mode focuses its first translatable row in the panel.
            const node = getNode(translateRef.current.blocks, msg.path)
            if (node) setFocusField(firstFieldOfBlock(translateRef.current.cells, blockKeyFor(node as unknown as Record<string, unknown>, msg.path)))
          }
          setSelectedPath(msg.path)
          setDockTab(msg.path ? 'settings' : 'elements')
          // A selected column is also where the next element lands (click a column, then pick an element).
          if (isColumnPath(msg.path)) {
            const column = getColumn(lockCtx.current.blocks, msg.path)
            if (column) setInsertTarget({ containerPath: msg.path, at: (column.blocks || []).length })
          }
          break
        case 'add':
          setInsertTarget({ containerPath: msg.containerPath, at: msg.at })
          setDockTab('elements')
          break
        case 'editDone': {
          const { path, field, itemIndex, value } = msg
          if (translateRef.current.translating) {
            if (Array.isArray(path)) saveCanvasText(path, field, value)
            break
          }
          if (Array.isArray(path) && !lockedOut(path)) applyBlocks((prev) => applyInlineEdit(prev, path, { field, itemIndex }, value), undefined, 'Text edited')
          break
        }
        case 'quickInsert':
          addBlockAt(msg.blockType, msg.containerPath, msg.at)
          break
        case 'delete':
          deleteBlock(msg.path)
          break
        case 'duplicate':
          duplicateBlock(msg.path)
          break
        case 'move':
          moveBlock(msg.path, msg.direction)
          break
        case 'moveTo':
          moveBlockTo(msg.from, msg.containerPath, msg.at)
          break
        case 'translateHint': {
          // Double-click on text that is translated in the panel (rich text, a divider): say so and focus its block's row.
          notifyTranslate(t('builder.translate.inPanel'))
          const node = getNode(translateRef.current.blocks, msg.path)
          if (node) setFocusField(firstFieldOfBlock(translateRef.current.cells, blockKeyFor(node as unknown as Record<string, unknown>, msg.path)))
          break
        }
        case 'key':
          if (translateRef.current.translating && msg.alt && (msg.key === 'ArrowLeft' || msg.key === 'ArrowRight')) {
            navigateUntranslated(msg.key === 'ArrowRight' ? 1 : -1)
            break
          }
          handleKeyRef.current({ key: msg.key, ctrl: msg.ctrl, meta: msg.meta, shift: msg.shift, alt: msg.alt })
          break
        case 'contextmenu': {
          const rect = iframeRef.current?.getBoundingClientRect()
          if (!rect || !Array.isArray(msg.path)) break
          setSelectedPath(msg.path)
          setDockTab('settings')
          setMenu({ x: rect.left + msg.x, y: rect.top + msg.y, path: msg.path })
          break
        }
      }
      if (msg.type === 'select' || msg.type === 'add') setMenu(null)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [deleteBlock, duplicateBlock, moveBlock, moveBlockTo, columnOp, renameNode, setColumnWidths, setPadding, toggleMulti, lockedOut, applyBlocks, addBlockAt, saveCanvasText, notifyTranslate, navigateUntranslated, t])

  const saveRef = useRef<((publish: boolean) => unknown) | null>(null)
  // Keyboard shortcuts: the parent's own key presses and the ones forwarded from the frame share this handler.
  const { handleKey } = useEditorShortcuts({
    enabled: !loading && !saveTemplateOpen && !importOpen && !menu,
    hasSelection: Boolean(selectedPath),
    handlers: {
      undo,
      redo,
      copy: () => (multiPaths.length > 0 ? void copyMulti() : selectedPath && void copyNode(selectedPath)),
      cut: () => (multiPaths.length > 0 ? void cutMulti() : selectedPath && void cutNode(selectedPath)),
      paste: () => void pasteAt(selectedPath),
      duplicate: () => (multiPaths.length > 0 ? duplicateMulti() : selectedPath && selectedPath.length % 2 === 1 && duplicateBlock(selectedPath)),
      delete: () => (multiPaths.length > 0 ? deleteMulti() : selectedPath && selectedPath.length % 2 === 1 && deleteBlock(selectedPath)),
      clear: () => {
        // While the shortcuts popover is open, Escape only closes it and keeps the selection.
        if (helpOpen) return
        // Escape first drops a multi-selection (the primary block stays selected); the next one deselects.
        if (multiPaths.length > 0) {
          setMulti(null)
          return
        }
        setSelectedPath(null)
        setDockTab('elements')
      },
      moveUp: () => selectedPath && moveBlock(selectedPath, -1),
      moveDown: () => selectedPath && moveBlock(selectedPath, 1),
      help: () => setHelpOpen((open) => !open),
      save: () => void saveRef.current?.(false),
      copyStyle: () => selectedPath && void copyStyle(selectedPath),
      pasteStyle: () => (multiPaths.length > 0 ? void pasteStyleMulti() : void pasteStyle(selectedPath)),
      navigator: () => setDockTab((t) => (t === 'navigator' ? 'elements' : 'navigator')),
      cycleDevice: () => setDevice((d) => (d === 'desktop' ? 'tablet' : d === 'tablet' ? 'mobile' : 'desktop')),
      togglePanel: () => setDockCollapsed((c) => !c),
      finder: () => setFinderOpen((open) => !open),
      history: () => {
        setDockCollapsed(false)
        showDockTab(dockTab === 'history' ? 'elements' : 'history')
      },
    },
  })
  useEffect(() => {
    handleKeyRef.current = handleKey
  }, [handleKey])

  // Pushes the current tree + selection down to the frame whenever either
  // changes (including every keystroke made in the field panel), and once
  // more as soon as the frame announces it has mounted and can receive it.
  useEffect(() => {
    if (!frameReady) return
    iframeRef.current?.contentWindow?.postMessage(
      { source: 've-canvas', type: 'init', blocks: canvasBlocks, selectedPath, selectedPaths: multiPaths, locks: lockMapForCanvas(blocks, locks, lockUser), device },
      CANVAS_ORIGIN(),
    )
  }, [frameReady, canvasBlocks, blocks, selectedPath, multiPaths, locks, lockUser, device])

  // Translate mode marks for the frame (the language's status per block, the source tooltip, and whether it may be edited).
  useEffect(() => {
    if (!frameReady) return
    iframeRef.current?.contentWindow?.postMessage(
      { source: 've-canvas', type: 'translate', active: translating, marks: canvasMarks, untranslatedLabel: t('builder.translate.untranslated') },
      CANVAS_ORIGIN(),
    )
  }, [frameReady, translating, canvasMarks, t])

  useEffect(() => {
    if (!frameReady) return
    iframeRef.current?.contentWindow?.postMessage({ source: 've-canvas', type: 'previewContext', context: previewCtx }, CANVAS_ORIGIN())
  }, [frameReady, previewCtx])

  const sendDragHover = useCallback((key: string | null) => {
    if (lastHoverKey.current === key) return
    lastHoverKey.current = key
    iframeRef.current?.contentWindow?.postMessage({ source: 've-canvas', type: 'dragHover', key }, CANVAS_ORIGIN())
  }, [])

  /* A card dragged out of the element library (ElementLibrary.tsx) carries a native HTML5
   * dataTransfer, which is shared across the whole browser-level drag session regardless of
   * which document a listener sits in - but a listener placed *inside* the iframe's own
   * document (as the old InsertSlot did) doesn't reliably receive dragover/drop for a drag
   * that started in the parent document. Handling it here instead, on the wrapper that sits
   * over the iframe in the parent document, sidesteps that entirely; elementFromPoint (above)
   * finds which insert slot the pointer is actually over inside the frame. */
  // Safari can hide custom types during dragover, so the card's in-memory registration counts as well.
  const isLibraryDrag = (event: React.DragEvent<HTMLDivElement>) => isLibraryDragTypes(event.dataTransfer.types) || currentLibraryDrag() !== null
  // Last slot a library drag hovered: inserted on dragend when the browser never fires `drop` (see dropSlot.ts).
  const [dragFallback] = useState(createDragFallback)

  const resolveAt = useCallback((clientX: number, clientY: number) => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return null
    const pt = clientToFrame(iframe.getBoundingClientRect(), clientX, clientY)
    return pt ? resolveDropSlotInDoc(doc, pt.x, pt.y) : null
  }, [])

  // Root cause of "can't drag from the dock": events over an <iframe> fire in the iframe's own
  // document and never reach React handlers on the parent wrapper, so while a library card is
  // dragged the frame is made pointer-transparent (CSS: .ve-canvas--lib-drag) and the wrapper
  // receives dragover/drop instead. Tracked from document-level drag events.
  const [libDrag, setLibDrag] = useState(false)
  useEffect(
    () =>
      trackLibraryDrag(document, (active) => {
        setLibDrag(active)
        if (active) dragFallback.start(currentLibraryDrag())
        else sendDragHover(null)
      }),
    [sendDragHover, dragFallback],
  )

  const onCanvasDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isLibraryDrag(event)) return
      event.preventDefault()
      const slot = resolveAt(event.clientX, event.clientY)
      // Auto-scroll the frame when hovering near its top/bottom edge.
      const frame = iframeRef.current
      if (frame) {
        const r = frame.getBoundingClientRect()
        if (event.clientY - r.top < 48) frame.contentWindow?.scrollBy(0, -24)
        else if (r.bottom - event.clientY < 48) frame.contentWindow?.scrollBy(0, 24)
      }
      // No valid slot (outside the page, or a locked container): not-allowed cursor, no highlight.
      const allowed = Boolean(slot) && canInsertInto(lockCtx.current.blocks, slot!.containerPath, lockCtx.current.locks, lockCtx.current.lockUser)
      event.dataTransfer.dropEffect = allowed ? 'copy' : 'none'
      sendDragHover(allowed ? slot!.key : null)
      dragFallback.hover(allowed ? slot : null)
    },
    [sendDragHover, resolveAt, dragFallback],
  )

  const onCanvasDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      // Only clear once the pointer has actually left the wrapper (not just moved onto a
      // child), otherwise the highlight flickers off between adjacent slots.
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
      sendDragHover(null)
      dragFallback.leave()
    },
    [sendDragHover, dragFallback],
  )

  const insertDragPayload = useCallback(
    (payload: LibraryDragPayload, slot: DropSlot) => {
      if (payload.kind === 'block') {
        addBlockAt(payload.slug, slot.containerPath, slot.at)
        return
      }
      try {
        const parsed: unknown = JSON.parse(payload.blocksJson)
        const templateLocks = payload.locksJson ? parseLocks(JSON.parse(payload.locksJson)) : undefined
        if (Array.isArray(parsed)) insertTemplateAt(parsed as SectionNode[], slot.containerPath, slot.at, templateLocks)
      } catch {
        setLockNotice('That template could not be dropped.')
        setTimeout(() => setLockNotice(null), 4000)
      }
    },
    [addBlockAt, insertTemplateAt],
  )

  const onCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const payload = readLibraryDrag(event.dataTransfer)
      const slot = resolveAt(event.clientX, event.clientY)
      sendDragHover(null)
      setLibDrag(false)
      if (!payload) return
      event.preventDefault()
      dragFallback.drop()
      if (!slot) {
        setLockNotice('Drop it between blocks, on a block, or in an empty column.')
        setTimeout(() => setLockNotice(null), 4000)
        return
      }
      insertDragPayload(payload, slot)
    },
    [insertDragPayload, sendDragHover, resolveAt, dragFallback],
  )

  // dragend always fires on the card, in every browser. When it ends over the canvas with no `drop` having
  // been handled (Safari / Firefox cross-frame drags), insert at the last slot the pointer hovered.
  useEffect(() => {
    const onEnd = () => {
      const pending = dragFallback.end()
      endLibraryDrag()
      setLibDrag(false)
      sendDragHover(null)
      if (pending) insertDragPayload(pending.payload, pending.slot)
    }
    document.addEventListener('dragend', onEnd)
    return () => document.removeEventListener('dragend', onEnd)
  }, [dragFallback, insertDragPayload, sendDragHover])

  const pageRef = useRef(pageSettings)
  useEffect(() => {
    pageRef.current = pageSettings
  }, [pageSettings])

  const lockable = surface?.slug === 'pages' || surface?.slug === 'page-templates' || surface?.slug === 'site-templates' || surface?.slug === 'reusable-sections'
  const save = async (publish: boolean, options: { unpublish?: boolean } = {}) => {
    if (!apiUrl || !surface) return
    if (lockedByOther) {
      flashNotice(t('ve.editLock.saveBlocked'))
      return
    }
    setSaving(publish ? 'publishing' : 'saving')
    // What this request carries. Edits made while it is in flight keep the dirty flag set.
    const sent = { blocks, locks, formConfig, pageSettings }
    try {
      if (pageSettings && pageInitial && validatePageSettings(pageSettings, pageAvail).length) throw new Error('Fix the page settings (title or slug) before saving.')
      const body: Record<string, unknown> = { [surface.blocksField]: stripEditorIds(blocks, lockedKeySet(locks)) }
      if (locksDirty && lockable) body.locks = serializeLocks(locks)
      if (surface.formMode) {
        // Draft saves touch the working copy only; Publish also takes the snapshot visitors see.
        body.formConfig = formConfig
        if (publish) {
          body.publishedLayout = body[surface.blocksField]
          body.formStatus = 'published'
        } else if (options.unpublish) {
          body.formStatus = 'draft'
        }
      } else {
        if (pageSettings && pageInitial) Object.assign(body, pageSettingsPatch(pageSettings, pageInitial, pageAvail))
        if (publish) body._status = 'published'
      }

      // Someone else may have saved since this editor loaded: ask before overwriting their work.
      if (loadedUpdatedAtRef.current) {
        const current = await fetch(`${apiUrl}?depth=0`, { credentials: 'include' }).catch((): Response | null => null)
        const latest = current && current.ok ? ((await current.json().catch((): null => null)) as { updatedAt?: unknown } | null) : null
        if (savedByAnotherSince(latest?.updatedAt, loadedUpdatedAtRef.current) && !window.confirm(t('ve.save.overwriteConfirm'))) {
          setSaving('idle')
          return
        }
      }

      const res = await fetch(apiUrl, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

      setSaving(publish ? 'published' : 'saved')
      setSavedAt(Date.now())
      // The response body is read once: the form branch and the updatedAt bookkeeping both use it.
      const saved = (await res.json().catch((): null => null)) as { doc?: { embedKey?: string; publishedLayout?: unknown; formStatus?: string } } | null
      const serverStamp = updatedAtFromSave(saved)
      if (serverStamp) {
        loadedUpdatedAtRef.current = serverStamp
      } else {
        // The response did not carry the document: read the stamp back so the next save compares against this one.
        const again = await fetch(`${apiUrl}?depth=0`, { credentials: 'include' }).catch((): Response | null => null)
        const fresh = again && again.ok ? ((await again.json().catch((): null => null)) as { updatedAt?: unknown } | null) : null
        if (typeof fresh?.updatedAt === 'string') loadedUpdatedAtRef.current = fresh.updatedAt
      }
      if (surface.formMode) {
        if (saved?.doc?.embedKey) setEmbedKey(saved.doc.embedKey)
        if (publish) {
          setFormStatus('published')
          setStatus('published')
          setPublishedLayout(body.publishedLayout)
        } else if (options.unpublish) {
          setFormStatus('draft')
          setStatus('draft')
        }
      } else {
        if (pageSettings) {
          setPageInitial(pageSettings)
          setDocTitle(pageSettings.title.trim() || docTitle)
          if (!publish) setStatus(pageSettings.status)
        }
        if (publish) {
          setStatus('published')
          setPageSettings((p) => (p ? { ...p, status: 'published' } : p))
          setPageInitial((p) => (p ? { ...p, status: 'published' } : p))
        }
      }
      const current = lockCtx.current
      if (current.blocks === sent.blocks && current.locks === sent.locks && current.formConfig === sent.formConfig && pageRef.current === sent.pageSettings) {
        setDirty(false)
        setLocksDirty(false)
        extraDirtyRef.current = false
      }
      // The server now holds the tree that was sent. Edits made while the request was in flight keep a draft.
      savedTreeRef.current = comparableTree(sent.blocks)
      if (draftKeyRef.current && comparableTree(blocksRef.current) === savedTreeRef.current) clearBlockDraft(draftKeyRef.current)
      setRevisionsKey((k) => k + 1)
      setTimeout(() => setSaving('idle'), 2000)
    } catch (err) {
      setSaving('error')
      setError(String((err as Error).message || err))
    }
  }
  // Keyboard shortcuts are wired before `save` exists; they reach it through this ref.
  useEffect(() => {
    saveRef.current = (publish: boolean) => save(publish)
  })

  /** Finder (Mod+E): nodes of this page by navigator name, plus the editor's commands. Pages are searched by the palette itself. */
  const finderEntries = useMemo<FinderEntry[]>(() => {
    if (!finderOpen) return []
    const cmd = (command: FinderCommandId, label: string) => ({ command, label, hint: t('ve.finder.command') })
    return [
      ...commandEntries([
        cmd('save', t('common.saveDraft')),
        cmd('publish', t('common.publish')),
        cmd('pageSettings', t('ve.finder.pageSettings')),
        cmd('navigator', t('ve.tab.navigator')),
        cmd('history', t('ve.tab.history')),
        cmd('desktop', t('ve.top.desktop')),
        cmd('tablet', t('ve.top.tablet')),
        cmd('mobile', t('ve.top.mobile')),
        cmd('importExport', t('ve.top.importExport')),
        cmd('shortcuts', t('ve.shortcuts.title')),
      ]),
      ...nodeEntries(flattenNavigatorNames(blocks, t)),
    ]
  }, [finderOpen, blocks, t])

  const pickFinderEntry = (entry: FinderEntry) => {
    setFinderOpen(false)
    if (entry.kind === 'node') {
      selectFromNavigator(entry.path)
      setDockTab('settings')
      // The frame scrolls the node into view when it is told about the selection.
      iframeRef.current?.contentWindow?.postMessage({ source: 've-canvas', type: 'selected', selectedPath: entry.path }, CANVAS_ORIGIN())
      return
    }
    if (entry.kind === 'page') {
      if (dirty && !window.confirm(t('ve.finder.leaveConfirm'))) return
      window.location.assign(pageEditorHref(adminRoot, entry.pageId))
      return
    }
    switch (entry.command) {
      case 'save':
        void save(false)
        break
      case 'publish':
        void save(true)
        break
      case 'pageSettings':
        setSelectedPath(null)
        setDockCollapsed(false)
        showDockTab('settings')
        break
      case 'navigator':
        setDockCollapsed(false)
        showDockTab('navigator')
        break
      case 'history':
        setDockCollapsed(false)
        showDockTab('history')
        break
      case 'desktop':
      case 'tablet':
      case 'mobile':
        setDevice(entry.command)
        break
      case 'importExport':
        setImportOpen(true)
        break
      case 'shortcuts':
        setHelpOpen(true)
        break
    }
  }

  /**
   * Preview page: saves a dirty page first, then opens its public address. The frontend serves the page marked
   * as homepage at "/", and any other page at its slug under its parents' slugs (the same rule as pagePaths.ts).
   */
  const openPreview = async () => {
    if (dirty) await save(false)
    const page = pageRef.current
    if (!page || !surface) return
    let path: string
    if (pageLinkInfo.current?.isHomepage) {
      path = '/'
    } else {
      const segments = [page.slug]
      let parent: unknown = pageLinkInfo.current?.parent
      for (let hops = 0; parent && hops < 8; hops += 1) {
        const id = typeof parent === 'object' ? (parent as { id?: unknown }).id : parent
        const res = await fetch(`/api/${surface.slug}/${String(id)}?depth=0`, { credentials: 'include' }).catch((): Response | null => null)
        const doc = res && res.ok ? ((await res.json()) as Record<string, unknown>) : null
        if (!doc || typeof doc.slug !== 'string') {
          flashNotice(t('ve.top.previewFailed'))
          return
        }
        segments.unshift(doc.slug)
        parent = doc.parent
      }
      path = `/${segments.join('/')}`
    }
    window.open(path, '_blank', 'noopener')
  }

  const selectedLock = selectedPath ? effectiveLock(blocks, selectedPath, locks, lockUser) : null
  const selectedKey = selectedPath ? lockKeyOf(selectedNode, selectedPath) : undefined
  const ownEntry = selectedKey ? locks.nodes[selectedKey] : undefined
  const canEditOwn = Boolean(lockUser?.roles?.includes('admin') || lockUser?.canManageLocks || (ownEntry && !selectedLock?.blocked))
  const textTypes = new Set(['text', 'textarea', 'richText'])
  const lockFieldDefs = selectedNode
    ? selectedNode.blockType === 'element'
      ? getElementDef(String((selectedNode as { elementType?: string }).elementType || ''))?.fields ?? []
      : selectedDef?.fields ?? []
    : []
  const lockUi: LockUi | undefined =
    lockable && selectedNode
      ? {
          lock: selectedLock,
          entry: ownEntry,
          hasKey: Boolean(selectedKey),
          canEditLock: canEditOwn,
          textFields: lockFieldDefs.filter((f) => textTypes.has(f.type)).map((f) => ({ name: f.name, label: f.label })),
          roleChoices,
          onChangeLock: (entry: LockEntry | null) => {
            if (!selectedKey) return
            setLocks((prev) => withNodeLock(prev, selectedKey, entry))
            setLocksDirty(true)
            extraDirtyRef.current = true
            setDirty(true)
          },
        }
      : undefined

  const formFieldChoices = useMemo(
    () => (formMode ? walkLayout(blocks).fields.filter((f) => f.name && f.type !== 'page').map((f) => ({ name: f.name!, label: f.label || f.name! })) : []),
    [formMode, blocks],
  )
  const formUnpublished = formMode ? formHasUnpublishedChanges({ layout: stripEditorIds(blocks, lockedKeySet(locks)), publishedLayout } as never) : false
  const isAdmin = Boolean(lockUser?.roles?.includes('admin'))

  const adminRoot = useAdminRoot()
  const backHref = surface
    ? surface.kind === 'global'
      ? `${adminRoot}/globals/${surface.slug}`
      : `${adminCollectionPath(surface.slug, adminRoot)}/${route?.id}`
    : adminRoot

  const menuItems = (path: NodePath): ContextMenuItem[] => {
    const { containerPath, index } = splitPath(path)
    const list = getList(blocks, containerPath) ?? []
    const locked = Boolean(effectiveLock(blocks, path, locks, lockUser)?.blocked)
    const canEditStyle = Boolean(userPermissions?.canEditStyle)
    return [
      { id: 'edit', label: 'Edit' },
      { id: 'copy', label: 'Copy', hint: `${modLabel}+C` },
      { id: 'cut', label: 'Cut', hint: `${modLabel}+X`, disabled: locked },
      { id: 'paste', label: 'Paste after', hint: `${modLabel}+V` },
      { id: 'duplicate', label: 'Duplicate', hint: `${modLabel}+D`, disabled: locked },
      { id: 'copy-style', label: 'Copy style', hint: `${modLabel}+Shift+C`, divider: true },
      { id: 'paste-style', label: 'Paste style', hint: `${modLabel}+Shift+V`, disabled: !hasStyleClipboard || !canEditStyle || locked },
      { id: 'reset-style', label: 'Reset style', disabled: locked || !canEditStyle },
      { id: 'navigator', label: 'Show in Navigator' },
      { id: 'up', label: 'Move up', hint: 'Alt+Up', disabled: locked || index <= 0 },
      { id: 'down', label: 'Move down', hint: 'Alt+Down', disabled: locked || index >= list.length - 1 },
      ...(formMode ? [] : [{ id: 'template', label: 'Save as template' }]),
      { id: 'delete', label: 'Delete', hint: 'Del', disabled: locked, danger: true },
    ]
  }

  // Settings for a column selected on the canvas (its path has an even length).
  const selectedColumnOwner = isColumnPath(selectedPath) ? getColumnOwner(blocks, selectedPath) : undefined
  const selectedColumnIndex = isColumnPath(selectedPath) ? selectedPath[selectedPath.length - 1] : -1
  const columnPanelNode =
    isColumnPath(selectedPath) && selectedColumnOwner?.columns?.[selectedColumnIndex] ? (
      <ColumnPanel
        section={selectedColumnOwner}
        index={selectedColumnIndex}
        device={device}
        onChange={(column) => updateSelectedColumn(selectedPath, column)}
        onOp={(op) => columnOp(selectedPath, op)}
        onSelectSection={() => setSelectedPath(selectedPath.slice(0, -1))}
        onClose={() => {
          setSelectedPath(null)
          setDockTab('elements')
        }}
        canEditLayout={userPermissions?.canEditLayout !== false}
        canEditStyle={userPermissions?.canEditStyle !== false}
      />
    ) : undefined

  if (loading) return <div className="ve-loading-screen">Loading visual editor</div>

  if (error && blocks.length === 0) {
    return (
      <div className="ve-loading-screen ve-error">
        Couldn&apos;t load this document: {error}. <a href={backHref}>Go back</a>
      </div>
    )
  }

  return (
    <div className="ve-root">
      { }
      <style dangerouslySetInnerHTML={{ __html: VISUAL_EDITOR_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: TRANSLATION_BAR_CSS + TRANSLATE_PANEL_CSS + TRANSLATE_BANNER_CSS + TRANSLATE_ACTIONS_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: NAVIGATOR_CSS + HISTORY_PANEL_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: IMPORT_EXPORT_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: AI_BUILDER_CSS }} />
      <div className="ve-topbar">
        <div className="ve-topbar__left">
          <a
            href={backHref}
            className="ve-btn ve-btn--ghost"
            onClick={(event) => {
              if (!dirty) return
              event.preventDefault()
              if (window.confirm('You have unsaved changes. Leave without saving?')) {
                window.location.href = backHref
              }
            }}
          >
            Back
          </a>
          <Tooltip text={dockCollapsed ? t('ve.top.showPanel') : t('ve.top.collapsePanel')}><button
            type="button"
            className="ve-btn ve-btn--ghost ve-btn--icon"
            onClick={() => setDockCollapsed((c) => !c)}
            aria-label={dockCollapsed ? t('ve.top.showPanel') : t('ve.top.collapsePanel')}
          >
            {dockCollapsed ? String.fromCodePoint(0xbb) : String.fromCodePoint(0xab)}
          </button></Tooltip>
          <span className="ve-topbar__title">
            {t('ve.top.title', { title: docTitle })} {status && <span className="ve-topbar__status">({status})</span>}
          </span>
        </div>
        <div className="ve-topbar__actions">
          {/* Always in the top bar for site-template docs, whatever is selected. */}
          {surface?.slug === 'site-templates' ? <PreviewAsPicker kind={templateKind} onContext={setPreviewCtx} /> : null}
          {translation ? (
            <TranslationBar
              defaultLocale={translation.defaultLocale}
              defaultLabel={localeLabel(translation.defaultLocale)}
              targets={translation.locales.map((group) => ({ code: group.locale, label: localeLabel(group.locale) }))}
              selected={editLocale ?? translation.defaultLocale}
              progress={translation.locales.map((group) => ({
                code: group.locale,
                label: localeLabel(group.locale),
                approved: group.approved,
                total: group.total,
              }))}
              onSelect={(code) => {
                setFocusField(null)
                setEditLocale(code === translation.defaultLocale ? null : code)
              }}
            />
          ) : null}
          <div className="ve-history" role="group" aria-label={t('ve.top.history')}>
            <Tooltip text={t('ve.top.undoTitle', { mod: modLabel })}><button
              type="button"
              className="ve-btn ve-btn--ghost"
              onClick={undo}
              disabled={!historyFlags.undo}
              aria-label={t('ve.shortcut.undo')}
            >
              {t('ve.shortcut.undo')}
            </button></Tooltip>
            <Tooltip text={t('ve.top.redoTitle', { mod: modLabel })}><button
              type="button"
              className="ve-btn ve-btn--ghost"
              onClick={redo}
              disabled={!historyFlags.redo}
              aria-label={t('ve.shortcut.redo')}
            >
              {t('ve.shortcut.redo')}
            </button></Tooltip>
          </div>
          {!compactBar && (
            <Tooltip text={t('ve.top.importTitle')}><button type="button" className="ve-btn ve-btn--ghost" onClick={() => setImportOpen(true)}>
              {t('ve.top.importExport')}
            </button></Tooltip>
          )}
          <ShortcutsHelp
            modLabel={modLabel}
            open={helpOpen}
            onOpenChange={setHelpOpen}
            onTour={() => setTourOpen(true)}
          />
          <div className="ve-device-toggle" role="group" aria-label={t('ve.top.devicePreview')}>
            <Tooltip text={t('ve.top.desktopPreviewTitle')}><button
              type="button"
              className={`ve-device-btn ${device === 'desktop' ? 've-device-btn--active' : ''}`}
              onClick={() => setDevice('desktop')}
              aria-label={t('ve.top.desktopPreview')}
            >
              {t('ve.top.desktop')}
            </button></Tooltip>
            <Tooltip text={t('ve.top.tabletPreview')}><button
              type="button"
              className={`ve-device-btn ${device === 'tablet' ? 've-device-btn--active' : ''}`}
              onClick={() => setDevice('tablet')}
              aria-label={t('ve.top.tabletPreview')}
            >
              {t('ve.top.tablet')}
            </button></Tooltip>
            <Tooltip text={t('ve.top.mobilePreview')}><button
              type="button"
              className={`ve-device-btn ${device === 'mobile' ? 've-device-btn--active' : ''}`}
              onClick={() => setDevice('mobile')}
              aria-label={t('ve.top.mobilePreview')}
            >
              {t('ve.top.mobile')}
            </button></Tooltip>
          </div>
          {!formMode && !compactBar && (
            <Tooltip text={selectedPath && selectedPath.length === 1 ? t('ve.top.templateSection') : t('ve.top.templatePage')}><button
              type="button"
              className="ve-btn"
              onClick={() => setSaveTemplateOpen(true)}
              disabled={blocks.length === 0}
            >
              {t('ve.top.saveAsTemplate')}
            </button></Tooltip>
          )}
          {compactBar && (
            <TopBarMore
              items={[
                { key: 'import', label: t('ve.top.importExport'), onSelect: () => setImportOpen(true) },
                ...(formMode ? [] : [{ key: 'template', label: t('ve.top.saveAsTemplate'), onSelect: () => setSaveTemplateOpen(true), disabled: blocks.length === 0 }]),
              ]}
            />
          )}
          {pageSettings && surface?.slug === 'pages' && (
            <Tooltip text={status !== 'published' ? t('ve.top.previewDraft') : t('ve.top.preview')}><button
              type="button"
              className="ve-btn ve-btn--icon"
              onClick={() => void openPreview()}
              aria-label={t('ve.top.preview')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button></Tooltip>
          )}
          <SaveStatusChip status={saving} dirty={dirty} savedAt={savedAt} onRetry={() => save(false)} />
          <button type="button" className="ve-btn" onClick={() => save(false)} disabled={saving === 'saving' || !dirty || lockedByOther}>
            {saving === 'saving' ? t('ve.top.saving') : saving === 'saved' ? t('status.saved') : t('common.saveDraft')}
          </button>
          <button
            type="button"
            className={`ve-btn ve-btn--primary${dirty || status !== 'published' ? ' ve-btn--dirty' : ''}`}
            onClick={() => save(true)}
            disabled={saving === 'publishing' || lockedByOther}
          >
            {saving === 'publishing' ? t('ve.top.publishing') : saving === 'published' ? t('status.published') : t('common.publish')}
          </button>
        </div>
      </div>
      {surface?.kind === 'collection' && route?.id && Number.isFinite(Number(route.id)) && (
        <EditLockBanner collectionSlug={surface.slug} id={Number(route.id)} onLockedByOther={setLockedByOther} />
      )}

      <FormEditorContext.Provider value={{ fields: formFieldChoices }}>
      <div className="ve-body">
        <EditorDock
          collapsed={dockCollapsed}
          tab={dockTab}
          translatePanel={
            translation && editLocale ? (
              <>
                <TranslateActions state={translation} locale={editLocale} onChanged={loadTranslations} onMessage={notifyTranslate} />
                <TranslatePanel
                  state={translation}
                  locale={editLocale}
                  localeLabel={localeLabel(editLocale)}
                  title={translation.title}
                  users={translation.users}
                  onSaved={loadTranslations}
                  onExit={exitTranslate}
                  focusFieldPath={focusField}
                  onDraftChange={(fieldPath, value) => setDrafts((prev) => ({ ...prev, [fieldPath]: value }))}
                />
              </>
            ) : undefined
          }
          onTabChange={showDockTab}
          targetLabel={insertTarget.containerPath.length === 0 ? 'the page' : 'this column'}
          onPickBlock={addBlock}
          onPickTemplate={addTemplateBlocks}
          selectedNode={selectedNode as Record<string, unknown> | undefined}
          selectedDef={selectedDef}
          onChangeSelected={updateSelected}
          onCloseSelected={() => {
            setSelectedPath(null)
            setDockTab('elements')
          }}
          onDeleteSelected={() => selectedPath && deleteBlock(selectedPath)}
          onDuplicateSelected={() => selectedPath && duplicateBlock(selectedPath)}
          userPermissions={userPermissions}
          lockUi={lockUi}
          device={device}
          onSelectColumn={(index) => {
            if (!selectedPath || selectedPath.length % 2 === 0) return
            setSelectedPath([...selectedPath, index])
            setDockTab('settings')
          }}
          columnPanel={columnPanelNode}
          onConvertLegacy={convertSelectedLegacy}
          tree={blocks}
          selectedPath={selectedPath}
          onSelectPath={(p) => {
            setSelectedPath(p)
            if (p) setDockTab('settings')
          }}
          selectedExtraPanel={
            selectedFormRef !== undefined ? (
              <FormBlockFieldsPanel key={String(selectedFormRef)} formId={selectedFormRef} editorHref={`${adminRoot}${formEditorPath(selectedFormRef)}`} />
            ) : undefined
          }
          multiPanel={
            multiPaths.length > 0 ? (
              <MultiSelectPanel
                count={multiPaths.length}
                canEditStyle={Boolean(userPermissions?.canEditStyle)}
                onDelete={deleteMulti}
                onDuplicate={duplicateMulti}
                onCopy={() => void copyMulti()}
                onPasteStyle={() => void pasteStyleMulti()}
                onClear={() => setMulti(null)}
              />
            ) : undefined
          }
          historyPanel={<HistoryPanel rows={historyList} onJump={jumpTo} revisions={revisions} onApplyRevision={applyRevision} />}
          navigatorPanel={
            <NavigatorPanel
              nodes={blocks}
              selectedPath={selectedPath}
              multiPaths={multiPaths}
              onSelect={selectFromNavigator}
              onRename={renameNode}
              onSetAnchor={setNodeAnchor}
              expandedState={navigatorExpandedState}
              onExpandedStateChange={setNavigatorExpandedState}
              onMove={moveBlockTo}
              onDesignChange={(path, design) =>
                applyBlocks((prev) => updateNode(prev, path, (n) => ({ ...n, design: design as typeof n.design })), `design:${pathKey(path)}`, 'Style edited')
              }
              isLocked={(path) => {
                const lock = effectiveLock(lockCtx.current.blocks, path, lockCtx.current.locks, lockCtx.current.lockUser)
                return Boolean(lock?.blocked && lock.mode === 'full')
              }}
            />
          }
          aiBuilder={
            formMode
              ? undefined
              : {
                  pageTitle: docTitle,
                  selectedSection: aiSelectedSection,
                  onInsertAtEnd: aiInsertAtEnd,
                  onReplaceSelected: aiReplaceSelected,
                }
          }
          pagePanel={
            pageSettings ? (
              <>
              <PageSettingsPanel
                value={pageSettings}
                available={pageAvail}
                onChange={(next) => {
                  setPageSettings(next)
                  extraDirtyRef.current = true
                  setDirty(true)
                }}
              />
              </>
            ) : undefined
          }
          formPanel={
            formMode ? (
              <FormSettingsPanel
                config={formConfig}
                onChange={(next) => {
                  setFormConfig(next)
                  extraDirtyRef.current = true
                  setDirty(true)
                }}
                formId={route?.id}
                embedKey={embedKey}
                formStatus={formStatus}
                hasUnpublishedChanges={formUnpublished}
                isAdmin={isAdmin}
                busy={saving === 'saving' || saving === 'publishing'}
                onPublish={() => save(true)}
                onUnpublish={() => save(false, { unpublish: true })}
              />
            ) : undefined
          }
        />

        <div className={`ve-canvas-wrap${translation && editLocale ? ' ve-canvas-wrap--translating' : ''}`} role="presentation">
          {translation && editLocale ? <TranslateBanner languageLabel={localeLabel(editLocale)} onExit={exitTranslate} /> : null}
          {draftOffer && (
            <div className="ve-error" role="status" style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{t('draft.foundUnsaved', { when: new Date(draftOffer.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>
              <button
                type="button"
                className="ve-btn"
                onClick={() => {
                  const restored = withIds(draftOffer.blocks)
                  setDraftOffer(null)
                  applyBlocks(() => restored, undefined, 'Draft restored')
                }}
              >
                {t('common.restore')}
              </button>
              <button
                type="button"
                className="ve-btn ve-btn--ghost"
                onClick={() => {
                  if (draftKeyRef.current) clearBlockDraft(draftKeyRef.current)
                  setDraftOffer(null)
                }}
              >
                {t('draft.discard')}
              </button>
            </div>
          )}
          {lockNotice && (
            <p className="ve-error" role="status" style={{ padding: 12 }}>
              &#128274; {lockNotice}
            </p>
          )}
          {error && (
            <p className="ve-error" style={{ padding: 12 }}>
              {error}
            </p>
          )}

          {/*
            The canvas itself is a same-origin iframe on the real front-end
            layout (real styles.css, fonts, Header/Footer) so what's shown
            here is pixel-exact with the live page - see
            visualEditor/canvasBridge.ts for why a same-document canvas
            can't do that safely, and what crosses the postMessage bridge.
            Sized by CSS alone (the ve-canvas--desktop/mobile width below);
            the iframe's own viewport width is what makes the site's real
            responsive breakpoints kick in, so no "device" value needs to be
            sent into the frame at all.
          */}
          <div
            className={`ve-canvas ve-canvas--${device} ${libDrag ? 've-canvas--lib-drag' : ''}`}
            onDragOver={onCanvasDragOver}
            onDragLeave={onCanvasDragLeave}
            onDrop={onCanvasDrop}
          >
            {!frameReady && <div className="ve-canvas__loading">Loading canvas</div>}
            <iframe
              ref={iframeRef}
              src="/visual-editor-canvas"
              title="Page canvas"
              className="ve-canvas__frame"
              style={{ display: frameReady ? 'block' : 'none' }}
            />
          </div>
        </div>
      </div>
      </FormEditorContext.Provider>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.path)}
          onClose={() => setMenu(null)}
          onChoose={(id) => {
            const path = menu.path
            const locked = Boolean(effectiveLock(blocks, path, locks, lockUser)?.blocked)
            setMenu(null)
            if (id === 'copy') void copyNode(path)
            else if (id === 'cut') void cutNode(path)
            else if (id === 'paste') void pasteAt(path)
            else if (id === 'edit') {
              setSelectedPath(path)
              // Text blocks open the in-place editor on the canvas; everything else opens its Settings.
              if (!locked && inlineCandidate(getNode(blocks, path), 0)) {
                iframeRef.current?.contentWindow?.postMessage({ source: 've-canvas', type: 'editText', path }, CANVAS_ORIGIN())
              } else setDockTab('settings')
            } else if (id === 'navigator') {
              setSelectedPath(path)
              setDockTab('navigator')
            } else if (id === 'copy-style') void copyStyle(path)
            else if (id === 'paste-style') void pasteStyle(path)
            else if (id === 'reset-style') resetStyle(path)
            else if (id === 'duplicate') duplicateBlock(path)
            else if (id === 'delete') deleteBlock(path)
            else if (id === 'up') moveBlock(path, -1)
            else if (id === 'down') moveBlock(path, 1)
            else if (id === 'template') {
              setSelectedPath(path)
              setSaveTemplateOpen(true)
            }
          }}
        />
      )}
      {structureTarget && (
        <StructurePicker inner={structureTarget.containerPath.length > 0} onPick={insertStructure} onCancel={() => setStructureTarget(null)} />
      )}
      {saveTemplateOpen && (
        <SaveAsTemplateDialog
          pageBlocks={blocks}
          selectedSection={selectedPath && selectedPath.length === 1 ? getNode(blocks, selectedPath) : undefined}
          defaultName={docTitle}
          onClose={() => setSaveTemplateOpen(false)}
          onSaved={() => {
            setSaveTemplateOpen(false)
            setTemplateToast('Saved to My templates')
            setTimeout(() => setTemplateToast(null), 4000)
          }}
        />
      )}
      {finderOpen && (
        <FinderPalette
          entries={finderEntries}
          currentId={route?.id}
          onPick={pickFinderEntry}
          onClose={() => setFinderOpen(false)}
        />
      )}
      {importOpen && (
        <ImportExportModal blocks={blocks} title={docTitle} onClose={closeImport} onAppend={importAppend} onReplace={importReplace} />
      )}
      <CoachMarks open={tourOpen && !loading} onClose={() => { setTourOpen(false); setTourDismissed(true) }} />
      {templateToast && (
        <div className="ve-tpl__toast" role="status">
          {templateToast}
        </div>
      )}
    </div>
  )
}

export default VisualEditorView
