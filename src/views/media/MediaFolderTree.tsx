'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { requestJson, postJson } from '@/features/media/admin/mediaApi'
import { breadcrumb, buildFolderTree, droppedPath, leafOf, parentOf, type FolderCount, type FolderNode } from '@/features/media/folderTree'

export const MEDIA_IDS_TYPE = 'application/x-engage-media-ids'
const FOLDER_TYPE = 'application/x-engage-media-folder'

type Flat = { node: FolderNode | null; path: string; depth: number }

/** Collapsible folder tree for the media library: counts, drag files or folders onto a folder, keyboard keys, breadcrumb. */
export function MediaFolderTree({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const current = (params.get('folder') ?? '').trim()
  const [rows, setRows] = useState<FolderCount[]>([])
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [over, setOver] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [focus, setFocus] = useState<string>(current)

  const load = useCallback(async () => {
    const res = await requestJson<{ rows: FolderCount[] }>('/api/admin-media-folders')
    if (res.ok !== false) setRows(res.data.rows)
  }, [])
  useEffect(() => {
    void load()
  }, [load, current])

  const tree = useMemo(() => buildFolderTree(rows), [rows])
  // Keep the current folder's ancestors open.
  useEffect(() => {
    if (!current) return
    setOpen((prev) => {
      const next = new Set(prev)
      breadcrumb(current).slice(0, -1).forEach((b) => next.add(b.path))
      return next
    })
  }, [current])

  const flat = useMemo(() => {
    const out: Flat[] = [{ node: null, path: '', depth: 0 }]
    const walk = (nodes: FolderNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ node: n, path: n.path, depth })
        if (open.has(n.path)) walk(n.children, depth + 1)
      }
    }
    walk(tree.roots, 1)
    return out
  }, [tree, open])

  const go = (path: string) => {
    const next = new URLSearchParams(params.toString())
    next.delete('page')
    if (path) next.set('folder', path)
    else next.delete('folder')
    const qs = next.toString()
    router.push(qs ? `?${qs}` : '?')
  }

  const call = async (body: Record<string, unknown>, done: string) => {
    const res = await postJson<{ to: string }>('/api/admin-media-folders', body)
    if (res.ok === false) {
      setMessage(res.error)
      return
    }
    setMessage(done)
    await load()
    if (body.action === 'delete' && (current === body.from || current.startsWith(`${String(body.from)}/`))) go(parentOf(String(body.from)))
    else if ((body.action === 'rename' || body.action === 'move') && (current === body.from || current.startsWith(`${String(body.from)}/`))) {
      go(res.data.to + current.slice(String(body.from).length))
    } else router.refresh()
  }

  const drop = async (event: React.DragEvent, target: string) => {
    event.preventDefault()
    setOver(null)
    if (!canEdit) return
    const ids = event.dataTransfer.getData(MEDIA_IDS_TYPE)
    const folder = event.dataTransfer.getData(FOLDER_TYPE)
    if (ids) {
      const list = ids.split(',').map(Number).filter((n) => n > 0)
      const res = await postJson<{ moved: number }>('/api/admin-media-move', { ids: list, folder: target })
      setMessage(res.ok === false ? res.error : `Moved ${res.data.moved} to ${target || 'the top level'}.`)
      await load()
      router.refresh()
    } else if (folder) {
      if (droppedPath(folder, target) === folder) return
      await call({ action: 'move', from: folder, parent: target }, `Moved ${leafOf(folder)} to ${target || 'the top level'}.`)
    }
  }

  const newFolder = async (parent: string) => {
    const name = window.prompt(parent ? `New folder inside ${parent}` : 'New folder name')
    if (!name) return
    // A folder exists once it holds a file: open it, so uploads and drops land there.
    const path = parent ? `${parent}/${name}` : name
    go(path)
    setMessage(`Folder ${path} is ready. It appears in the tree once it holds a file.`)
  }
  const rename = async (path: string) => {
    const name = window.prompt('Rename folder', leafOf(path))
    if (!name || name === leafOf(path)) return
    const parent = parentOf(path)
    await call({ action: 'rename', from: path, to: parent ? `${parent}/${name}` : name }, 'Folder renamed.')
  }
  const remove = async (path: string) => {
    if (!window.confirm(`Delete folder ${path}? Its files move up one level; nothing is deleted.`)) return
    await call({ action: 'delete', from: path }, 'Folder removed. Files moved up one level.')
  }

  const onKey = (event: React.KeyboardEvent, index: number) => {
    const item = flat[index]
    if (!item) return
    const move = (i: number) => {
      const t = flat[Math.max(0, Math.min(flat.length - 1, i))]
      setFocus(t.path)
      document.getElementById(`mft-${t.path || 'root'}`)?.focus()
    }
    const expandable = Boolean(item.node?.children.length)
    if (event.key === 'ArrowDown') move(index + 1)
    else if (event.key === 'ArrowUp') move(index - 1)
    else if (event.key === 'ArrowRight' && expandable) {
      if (!open.has(item.path)) setOpen(new Set(open).add(item.path))
      else move(index + 1)
    } else if (event.key === 'ArrowLeft') {
      if (expandable && open.has(item.path)) {
        const next = new Set(open)
        next.delete(item.path)
        setOpen(next)
      } else if (item.path) move(flat.findIndex((f) => f.path === parentOf(item.path)))
    } else if (event.key === 'Enter' || event.key === ' ') go(item.path)
    else if (event.key === 'F2' && canEdit && item.path) void rename(item.path)
    else if (event.key === 'Delete' && canEdit && item.path) void remove(item.path)
    else return
    event.preventDefault()
  }

  const btn = 'rounded-[3px] border border-[var(--theme-elevation-200)] px-[6px] py-[2px] text-[calc(var(--base)*0.65)] text-[var(--theme-elevation-700)] hover:border-[var(--ac-gold)]'
  return (
    <nav aria-label="Media folders" className="flex w-full flex-col gap-[calc(var(--base)*0.4)] md:w-[240px] md:shrink-0">
      <ol className="m-0 flex flex-wrap items-center gap-[4px] p-0 text-[calc(var(--base)*0.72)] text-[var(--theme-elevation-600)]" style={{ listStyle: 'none' }} aria-label="Breadcrumb">
        <li><button type="button" className="border-0 bg-transparent p-0 text-[var(--ac-gold)]" onClick={() => go('')}>All files</button></li>
        {breadcrumb(current).map((b) => (
          <li key={b.path}>/ <button type="button" className="border-0 bg-transparent p-0 text-[var(--ac-gold)]" onClick={() => go(b.path)}>{b.name}</button></li>
        ))}
      </ol>
      <ul role="tree" className="m-0 flex flex-col gap-[1px] p-0" style={{ listStyle: 'none' }}>
        {flat.map((item, index) => {
          const isOpen = open.has(item.path)
          const label = item.node ? item.node.name : 'All files'
          const count = item.node ? item.node.total : tree.total
          return (
            <li
              key={item.path || 'root'}
              role="treeitem"
              aria-selected={current === item.path}
              aria-expanded={item.node?.children.length ? isOpen : undefined}
              style={{ paddingLeft: item.depth * 12 }}
            >
              <div
                className={`group flex items-center gap-[4px] rounded-[3px] ${over === item.path ? 'bg-[var(--ac-gold)]/20' : current === item.path ? 'bg-[var(--theme-elevation-100)]' : ''}`}
                draggable={canEdit && Boolean(item.path)}
                onDragStart={(e) => e.dataTransfer.setData(FOLDER_TYPE, item.path)}
                onDragOver={(e) => {
                  if (!canEdit) return
                  e.preventDefault()
                  setOver(item.path)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => void drop(e, item.path)}
              >
                {item.node?.children.length ? (
                  <button type="button" aria-label={isOpen ? 'Collapse' : 'Expand'} tabIndex={-1} className="w-[16px] border-0 bg-transparent p-0" onClick={() => setOpen((p) => { const n = new Set(p); if (n.has(item.path)) n.delete(item.path); else n.add(item.path); return n })}>
                    {isOpen ? '▾' : '▸'}
                  </button>
                ) : <span className="w-[16px]" />}
                <button
                  id={`mft-${item.path || 'root'}`}
                  type="button"
                  tabIndex={focus === item.path || (!focus && !item.path) ? 0 : -1}
                  onFocus={() => setFocus(item.path)}
                  onKeyDown={(e) => onKey(e, index)}
                  onClick={() => go(item.path)}
                  className="flex-1 truncate border-0 bg-transparent p-[3px] text-left text-[calc(var(--base)*0.78)] text-[var(--theme-elevation-900)]"
                >
                  {label} <span className="text-[var(--theme-elevation-500)]">({count})</span>
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {canEdit ? (
        <div className="flex flex-wrap gap-[4px]">
          <button type="button" className={btn} onClick={() => void newFolder(current)}>New folder</button>
          {current ? <button type="button" className={btn} onClick={() => void rename(current)}>Rename</button> : null}
          {current ? <button type="button" className={btn} onClick={() => void remove(current)}>Delete</button> : null}
        </div>
      ) : null}
      {message ? <p role="status" className="m-0 text-[calc(var(--base)*0.7)] text-[var(--theme-elevation-600)]">{message}</p> : null}
    </nav>
  )
}
