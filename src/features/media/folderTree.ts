/**
 * Pure folder-tree helpers for the media library. Folders are text paths on each file, so the tree is built from
 * `folder -> file count` rows, and a rename or move is a prefix swap on those paths.
 */
import { MAX_FOLDER_LENGTH, sanitizeFolder } from './folders'

export type FolderCount = { folder: string; count: number }
export type FolderNode = { name: string; path: string; own: number; total: number; children: FolderNode[] }

/** Builds the tree. Files at the top level (empty folder) are counted in `rootCount`. */
export function buildFolderTree(rows: FolderCount[]): { roots: FolderNode[]; rootCount: number; total: number } {
  const roots: FolderNode[] = []
  let rootCount = 0
  const find = (list: FolderNode[], name: string, path: string): FolderNode => {
    let node = list.find((n) => n.name === name)
    if (!node) {
      node = { name, path, own: 0, total: 0, children: [] }
      list.push(node)
    }
    return node
  }
  for (const row of rows) {
    const folder = (row.folder ?? '').trim()
    const count = Math.max(0, Number(row.count) || 0)
    if (!folder) {
      rootCount += count
      continue
    }
    let list = roots
    let path = ''
    const parts = folder.split('/')
    parts.forEach((part, i) => {
      path = path ? `${path}/${part}` : part
      const node = find(list, part, path)
      node.total += count
      if (i === parts.length - 1) node.own += count
      list = node.children
    })
  }
  const sort = (nodes: FolderNode[]): void => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  return { roots, rootCount, total: rootCount + roots.reduce((n, r) => n + r.total, 0) }
}

/** The folder path a file is in after `from` becomes `to`, or null when it is not inside `from`. */
export function remapFolder(current: string, from: string, to: string): string | null {
  if (current === from) return to
  if (current.startsWith(`${from}/`)) return to ? `${to}${current.slice(from.length)}` : current.slice(from.length + 1)
  return null
}

export const parentOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
export const leafOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Breadcrumb steps for a path, each with the path to open. */
export function breadcrumb(path: string): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = []
  let acc = ''
  for (const part of path.split('/').filter(Boolean)) {
    acc = acc ? `${acc}/${part}` : part
    out.push({ name: part, path: acc })
  }
  return out
}

export type FolderMove = { ok: true; to: string } | { ok: false; error: string }

/** Checks moving or renaming folder `from` to the new full path `to`. */
export function checkFolderMove(from: string, toRaw: unknown): FolderMove {
  const source = sanitizeFolder(from)
  const to = sanitizeFolder(toRaw)
  if (!source) return { ok: false, error: 'Choose a folder to change.' }
  if (to === null || to === '') return { ok: false, error: `Folder names can use letters, numbers, spaces, hyphens, underscores and slashes, up to ${MAX_FOLDER_LENGTH} characters.` }
  if (to === source) return { ok: false, error: 'That is already the folder name.' }
  if (to.startsWith(`${source}/`)) return { ok: false, error: 'A folder cannot go inside itself.' }
  return { ok: true, to }
}

/** The new full path when `from` is dropped into `parent` ('' for the top level). */
export const droppedPath = (from: string, parent: string): string => (parent ? `${parent}/${leafOf(from)}` : leafOf(from))
