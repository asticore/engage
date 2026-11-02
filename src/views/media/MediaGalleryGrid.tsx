'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { describeSaving, formatBytes, postJson, requestJson } from '@/features/media/admin/mediaApi'
import {
  effectivePictureFormat,
  effectiveVideoFormat,
  fileTypeLabel,
  isVideoLinkMimeType,
  isVideoMimeType,
  pictureFormatLabel,
  type PictureFormat,
} from '@/features/media/formats'
import { VideoLinkForm } from './VideoLinkForm'

import { INLINE_IMAGE_TYPES } from '@/features/media/fileTypes'

import { FileIcon } from './FileIcon'
import { StockPhotoDialog } from './StockPhotoDialog'

export interface GalleryDoc {
  id: string
  url?: string
  filename?: string
  alt?: string
  mimeType?: string
  filesize?: number
  editHref: string
  folder?: string
  originalSize?: number
  optimizedSize?: number
  outputFormat?: string
}

/** What the site is set to output, read on the server and passed down (see MediaGalleryView). */
export type GalleryFormats = {
  siteImage: PictureFormat
  siteVideo: 'original' | 'mp4' | 'webm'
  streamReady: boolean
}

type TileSize = 'sm' | 'md' | 'lg'
type Provider = 'claude' | 'openai'

const TILE_MIN_WIDTH: Record<TileSize, string> = {
  sm: '120px',
  md: '180px',
  lg: '260px',
}

const STORAGE_KEY = 'engage-media-gallery-tile-size'

/** Alt text is written in batches of this size - the route's own per-request limit. */
const ALT_BATCH = 25

const OPTIMISABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** The line on a tile that says what Optimise will do to this file, or null when it does nothing. */
function targetLine(doc: GalleryDoc, formats: GalleryFormats): string | null {
  if (isVideoLinkMimeType(doc.mimeType)) return null
  if (isVideoMimeType(doc.mimeType)) {
    const target = effectiveVideoFormat(doc.outputFormat, formats.siteVideo)
    if (target === 'mp4') return `${fileTypeLabel(doc.mimeType)} to MP4 (Stream)`
    if (target === 'webm') return `${fileTypeLabel(doc.mimeType)} kept (WebM not made)`
    return `${fileTypeLabel(doc.mimeType)} (no output format set)`
  }
  if (!doc.mimeType || !OPTIMISABLE.has(doc.mimeType)) return null
  const target = effectivePictureFormat(doc.outputFormat, formats.siteImage)
  return target === 'original' ? `${fileTypeLabel(doc.mimeType)} kept as it is` : `${fileTypeLabel(doc.mimeType)} to ${pictureFormatLabel(target)}`
}

function readStoredSize(): TileSize {
  // Runs inside useState's lazy initializer, not an effect, so no extra render
  // cascades from it. The server render uses 'md'; the difference is silenced
  // with suppressHydrationWarning on the element whose layout depends on it.
  if (typeof window === 'undefined') return 'md'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'sm' || stored === 'md' || stored === 'lg') return stored
  } catch {
    // localStorage can throw in locked-down browser contexts - fall through to the default.
  }
  return 'md'
}

/** The size shown on a tile: the stored size, and the saving once a picture has been optimised. */
function sizeLabel(doc: GalleryDoc): string {
  if (doc.originalSize && doc.optimizedSize && doc.originalSize !== doc.optimizedSize) {
    return describeSaving(doc.originalSize, doc.optimizedSize)
  }
  return formatBytes(doc.filesize)
}

/**
 * The interactive half of the media gallery: tile size, selection, bulk actions
 * (optimise, alt text, move to folder, stock search) and the thumbnail grid.
 * Split from the server view so the list itself never crosses the boundary twice.
 */
export function MediaGalleryGrid({
  docs,
  folders,
  currentFolder,
  batchSize,
  optimisationOn,
  noticeFromServer,
  formats,
}: {
  docs: GalleryDoc[]
  folders: string[]
  currentFolder: string
  batchSize: number
  optimisationOn: boolean
  noticeFromServer?: string
  formats: GalleryFormats
}) {
  const router = useRouter()
  const [size, setSize] = useState<TileSize>(readStoredSize)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [provider, setProvider] = useState<Provider>('claude')
  const [keys, setKeys] = useState<Record<Provider, boolean> | null>(null)
  const [folderInput, setFolderInput] = useState('')
  const [stockOpen, setStockOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)

  useEffect(() => {
    let active = true
    requestJson<{ providers: Record<Provider, boolean> }>('/api/admin-media-alt').then((result) => {
      if (!active || result.ok === false) return
      setKeys(result.data.providers)
      if (!result.data.providers.claude && result.data.providers.openai) setProvider('openai')
    })
    return () => {
      active = false
    }
  }, [])

  const chooseSize = (next: TileSize) => {
    setSize(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore - persistence is a convenience, not a requirement.
    }
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectedIds = docs.filter((doc) => selected.has(doc.id)).map((doc) => Number(doc.id))
  const allSelected = docs.length > 0 && selectedIds.length === docs.length

  const finish = (kind: 'ok' | 'error', text: string) => {
    setNotice({ kind, text })
    setBusy(null)
    router.refresh()
  }

  const optimiseIds = async (ids: number[]) => {
    setBusy('optimise')
    setNotice(null)
    let optimised = 0
    let kept = 0
    let failed = 0
    let converting = 0
    let needsStream = 0
    let reason = ''
    for (let i = 0; i < ids.length; i += batchSize) {
      const result = await postJson<{ results: Array<{ status: string; reason?: string }> }>('/api/admin-media-optimise', {
        ids: ids.slice(i, i + batchSize),
      })
      if (result.ok === false) {
        finish('error', result.error)
        return
      }
      for (const item of result.data.results) {
        if (item.status === 'optimised') optimised += 1
        else if (item.status === 'failed') failed += 1
        else if (item.status === 'converting') converting += 1
        else if (item.status === 'needs-stream') needsStream += 1
        else kept += 1
        if (item.reason && !reason && item.status !== 'optimised') reason = item.reason
      }
    }
    setSelected(new Set())
    const parts = [`Optimised ${optimised}`]
    if (converting) parts.push(`${converting} converting in Stream (press Optimise again)`)
    if (kept) parts.push(`left ${kept} as they were`)
    if (needsStream) parts.push(`${needsStream} need Cloudflare Stream`)
    if (failed) parts.push(`${failed} failed`)
    const text = `${parts.join('. ')}.${failed === 0 && reason && optimised === 0 ? ` ${reason}` : ''}`
    finish(failed > 0 ? 'error' : 'ok', text)
  }

  const writeAlt = async (ids: number[]) => {
    setBusy('alt')
    setNotice(null)
    let written = 0
    let failed = 0
    let firstError = ''
    for (let i = 0; i < ids.length; i += ALT_BATCH) {
      const result = await postJson<{ results: Array<{ status: string; reason?: string }> }>('/api/admin-media-alt', {
        ids: ids.slice(i, i + ALT_BATCH),
        provider,
        overwrite: false,
      })
      if (result.ok === false) {
        finish('error', result.error)
        return
      }
      for (const item of result.data.results) {
        if (item.status === 'updated') written += 1
        else if (item.status === 'failed') {
          failed += 1
          firstError = firstError || item.reason || ''
        }
      }
    }
    setSelected(new Set())
    finish(
      failed > 0 ? 'error' : 'ok',
      `Wrote alt text for ${written}.${failed ? ` ${failed} failed${firstError ? `: ${firstError}` : ''}` : ''}`,
    )
  }

  const moveTo = async (ids: number[], folder: string) => {
    setBusy('move')
    setNotice(null)
    const result = await postJson<{ moved: number }>('/api/admin-media-move', { ids, folder })
    if (result.ok === false) return finish('error', result.error)
    setSelected(new Set())
    setFolderInput('')
    finish('ok', `Moved ${result.data.moved} to ${folder || 'the top level'}.`)
  }

  const optimiseOne = (id: string) => {
    const doc = docs.find((item) => item.id === id)
    if (doc && isVideoMimeType(doc.mimeType) && !formats.streamReady) {
      setNotice({ kind: 'error', text: 'Video conversion needs Cloudflare Stream. Add the account ID and API token under Media settings, Video.' })
      return
    }
    return optimiseIds([Number(id)])
  }

  const copyUrl = async (doc: GalleryDoc) => {
    if (!doc.url) return
    const absolute = new URL(doc.url, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(absolute)
      setNotice({ kind: 'ok', text: `Copied the address of ${doc.filename ?? 'the file'}.` })
    } catch {
      // Clipboard access can be refused (insecure context, permissions): show the address so it can be copied by hand.
      window.prompt('Copy this address', absolute)
    }
  }

  const tileSizeButtons = (['sm', 'md', 'lg'] as const).map((option) => (
    <button
      key={option}
      type="button"
      onClick={() => chooseSize(option)}
      aria-pressed={size === option}
      suppressHydrationWarning
      className={`rounded-[4px] border px-[calc(var(--base)*0.5)] py-[calc(var(--base)*0.25)] text-[calc(var(--base)*0.72)] uppercase tracking-[0.04em] [transition:border-color_0.15s_ease,color_0.15s_ease] ${
        size === option ? 'border-[var(--ac-gold)] text-[var(--ac-gold)]' : 'border-[var(--theme-elevation-200)] text-[var(--theme-elevation-600)] hover:border-[var(--theme-elevation-400)]'
      }`}
    >
      {option}
    </button>
  ))

  const buttonClass =
    'rounded-[4px] border border-[var(--theme-elevation-200)] px-[10px] py-[5px] text-[12px] text-[var(--theme-elevation-800)] hover:border-[var(--ac-gold)] hover:text-[var(--ac-gold)] disabled:opacity-50'

  return (
    <div className="flex flex-col gap-[calc(var(--base)*0.75)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--base)]">
        <div className="flex items-center gap-[calc(var(--base)*0.4)]">
          <label className="flex items-center gap-[6px] text-[12px] text-[var(--theme-elevation-700)]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(docs.map((doc) => doc.id)))}
            />
            Select all on this page
          </label>
          <button type="button" className={buttonClass} onClick={() => setStockOpen(true)}>
            Search stock photos
          </button>
          <button type="button" className={buttonClass} aria-expanded={linkOpen} onClick={() => setLinkOpen((open) => !open)}>
            Add video link
          </button>
          {currentFolder ? <span className="text-[12px] text-[var(--theme-elevation-500)]">Folder: {currentFolder}</span> : null}
        </div>
        <div className="flex items-center gap-[calc(var(--base)*0.25)]">{tileSizeButtons}</div>
      </div>

      {selectedIds.length > 0 ? (
        <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-[10px] rounded-[6px] border border-[var(--ac-gold)] p-[10px]">
          <span className="text-[12px] font-medium text-[var(--theme-elevation-800)]">{selectedIds.length} selected</span>
          <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => optimiseIds(selectedIds)} title={optimisationOn ? undefined : 'Pictures need optimisation switched on in Media settings. Videos need Cloudflare Stream.'}>
            {busy === 'optimise' ? 'Optimising...' : 'Optimise'}
          </button>
          <label className="flex items-center gap-[6px] text-[12px] text-[var(--theme-elevation-700)]">
            Alt text with
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
              className="rounded-[4px] border border-[var(--theme-elevation-200)] bg-transparent px-[6px] py-[4px] text-[12px]"
            >
              <option value="claude">Claude{keys && !keys.claude ? ' (no key)' : ''}</option>
              <option value="openai">OpenAI{keys && !keys.openai ? ' (no key)' : ''}</option>
            </select>
          </label>
          <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => writeAlt(selectedIds)}>
            {busy === 'alt' ? 'Writing...' : 'Generate alt text'}
          </button>
          <form
            className="flex items-center gap-[6px]"
            onSubmit={(event) => {
              event.preventDefault()
              moveTo(selectedIds, folderInput.trim())
            }}
          >
            <input
              list="media-folder-options"
              value={folderInput}
              onChange={(event) => setFolderInput(event.target.value)}
              placeholder="Folder, e.g. products/summer"
              aria-label="Destination folder"
              className="w-[200px] rounded-[4px] border border-[var(--theme-elevation-200)] bg-transparent px-[8px] py-[4px] text-[12px]"
            />
            <datalist id="media-folder-options">
              {folders.map((folder) => (
                <option key={folder} value={folder} />
              ))}
            </datalist>
            <button type="submit" className={buttonClass} disabled={busy !== null}>
              Move to folder
            </button>
          </form>
          <button type="button" className="text-[12px] text-[var(--theme-elevation-500)] hover:text-[var(--ac-gold)]" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      ) : null}

      {linkOpen ? (
        <VideoLinkForm
          onAdded={() => {
            setLinkOpen(false)
            setNotice({ kind: 'ok', text: 'Video link added. Set its poster picture on its edit screen.' })
            router.refresh()
          }}
          onCancel={() => setLinkOpen(false)}
        />
      ) : null}

      {notice || noticeFromServer ? (
        <p role="status" className={`m-0 text-[12px] ${notice?.kind === 'error' ? 'text-[var(--theme-error-600,#c53030)]' : 'text-[var(--theme-elevation-700)]'}`}>
          {notice?.text ?? noticeFromServer}
        </p>
      ) : null}

      <div
        className="grid gap-[calc(var(--base)*0.6)]"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_MIN_WIDTH[size]}, 1fr))` }}
        suppressHydrationWarning
      >
        {docs.map((doc) => {
          const canOptimise = (optimisationOn && Boolean(doc.mimeType && OPTIMISABLE.has(doc.mimeType))) || (isVideoMimeType(doc.mimeType) && !isVideoLinkMimeType(doc.mimeType))
          const target = targetLine(doc, formats)
          return (
            <div
              key={doc.id}
              className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[var(--theme-elevation-150)] bg-[var(--ac-surface)] [transition:border-color_0.15s_ease] hover:border-[var(--ac-gold)]"
            >
              <label className="absolute left-[6px] top-[6px] z-10 flex h-[18px] w-[18px] items-center justify-center rounded-[3px] bg-[var(--theme-elevation-0)]/80">
                <input
                  type="checkbox"
                  aria-label={`Select ${doc.filename ?? doc.id}`}
                  checked={selected.has(doc.id)}
                  onChange={() => toggle(doc.id)}
                />
              </label>
              <Link href={doc.editHref} className="flex flex-col no-underline">
                <div className="flex aspect-square items-center justify-center overflow-hidden bg-[var(--theme-elevation-50)]">
                  {doc.url && doc.mimeType && INLINE_IMAGE_TYPES.has(doc.mimeType) ? (
                    <img
                      src={doc.url}
                      alt={doc.alt ?? doc.filename ?? ''}
                      loading="lazy"
                      className="h-full w-full object-cover [transition:transform_0.15s_ease] group-hover:scale-105"
                    />
                  ) : (
                    <FileIcon mimeType={doc.mimeType} filename={doc.filename} />
                  )}
                </div>
                <div className="flex flex-col gap-[calc(var(--base)*0.1)] px-[calc(var(--base)*0.5)] pt-[calc(var(--base)*0.4)]">
                  <span className="truncate text-[calc(var(--base)*0.72)] font-medium text-[var(--theme-elevation-900)]">{doc.filename ?? doc.id}</span>
                  {sizeLabel(doc) ? <span className="text-[calc(var(--base)*0.65)] text-[var(--theme-elevation-500)]">{sizeLabel(doc)}</span> : null}
                  {target && (optimisationOn || isVideoMimeType(doc.mimeType)) ? (
                    <span className="truncate text-[calc(var(--base)*0.65)] text-[var(--theme-elevation-500)]" title="What Optimise does to this file">{target}</span>
                  ) : null}
                  {doc.folder ? <span className="truncate text-[calc(var(--base)*0.65)] text-[var(--theme-elevation-500)]">{doc.folder}</span> : null}
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-[6px] px-[calc(var(--base)*0.5)] pb-[calc(var(--base)*0.4)] pt-[calc(var(--base)*0.3)]">
                {doc.url ? (
                  <>
                    <button type="button" className={buttonClass} onClick={() => copyUrl(doc)} aria-label={`Copy address of ${doc.filename ?? doc.id}`}>
                      Copy URL
                    </button>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className={`${buttonClass} no-underline`}>
                      {doc.mimeType && INLINE_IMAGE_TYPES.has(doc.mimeType) ? 'Open' : 'Download'}
                    </a>
                  </>
                ) : null}
                {canOptimise ? (
                  <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => optimiseOne(doc.id)}>
                    {busy === 'optimise' ? 'Optimising...' : isVideoMimeType(doc.mimeType) && !formats.streamReady ? 'Optimise (needs Stream)' : 'Optimise'}
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {stockOpen ? (
        <StockPhotoDialog
          onClose={() => setStockOpen(false)}
          onImported={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
