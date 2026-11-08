import type { BlockStyle } from '@/lib/blockStyle'
import type { SectionNode } from '@/lib/sectionTree'

import { applyPastedStyle } from './editorClipboard'
import { cloneNode, getNode, insertNode, pathKey, splitPath, uniquifyAnchors, updateNode, type NodePath } from './treeOps'

/**
 * Pure helpers for multi-select. Only blocks (odd-length paths) can be multi-selected. Every bulk
 * operation takes the whole tree and returns the whole new tree, so the editor applies it with one
 * applyBlocks call (one undo step).
 */

const isBlockPath = (path: NodePath) => path.length > 0 && path.length % 2 === 1

/** Document order: compares two paths element by element; a parent sorts before its descendants. */
export function comparePaths(a: NodePath, b: NodePath): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

export function sameContainer(a: NodePath, b: NodePath): boolean {
  return a.length === b.length && pathKey(a.slice(0, -1)) === pathKey(b.slice(0, -1))
}

/** Adds `path` to the selection, or removes it when already in it. Non-block paths are ignored. Result is in document order. */
export function toggleInSelection(selected: readonly NodePath[], path: NodePath): NodePath[] {
  if (!isBlockPath(path)) return [...selected]
  const key = pathKey(path)
  const has = selected.some((p) => pathKey(p) === key)
  const next = has ? selected.filter((p) => pathKey(p) !== key) : [...selected, path]
  return next.sort(comparePaths)
}

/** Shift-click: every block between `anchor` and `target` (inclusive) when both sit in one container; otherwise just `target`. */
export function rangeInContainer(anchor: NodePath | null, target: NodePath): NodePath[] {
  if (!anchor || !isBlockPath(anchor) || !isBlockPath(target) || !sameContainer(anchor, target)) return [target]
  const container = target.slice(0, -1)
  const from = Math.min(anchor[anchor.length - 1], target[target.length - 1])
  const to = Math.max(anchor[anchor.length - 1], target[target.length - 1])
  const out: NodePath[] = []
  for (let i = from; i <= to; i++) out.push([...container, i])
  return out
}

/** Drops paths that sit inside another selected path (acting on the parent already covers them); document order. */
export function topLevelPaths(paths: readonly NodePath[]): NodePath[] {
  const seen = new Set<string>()
  const sorted = [...paths]
    .filter((p) => isBlockPath(p) && !seen.has(pathKey(p)) && seen.add(pathKey(p)))
    .sort(comparePaths)
  return sorted.filter((p) => !sorted.some((q) => q.length < p.length && q.every((n, k) => n === p[k])))
}

/** Delete order: last in document order first, so earlier paths stay valid. */
export function deleteOrder(paths: readonly NodePath[]): NodePath[] {
  return topLevelPaths(paths).reverse()
}

export function deleteNodes(blocks: SectionNode[], paths: readonly NodePath[]): SectionNode[] {
  let next = blocks
  for (const path of deleteOrder(paths)) next = updateNode(next, path, () => null)
  return next
}

/** Puts a copy of each selected block right after the original. Copies are made last-first so paths stay valid. */
export function duplicateNodes(blocks: SectionNode[], paths: readonly NodePath[], makeId: () => string): SectionNode[] {
  let next = blocks
  for (const path of deleteOrder(paths)) {
    const original = getNode(next, path)
    if (!original) continue
    const [copy] = uniquifyAnchors(next, [cloneNode(original, makeId)])
    const { containerPath, index } = splitPath(path)
    next = insertNode(next, containerPath, index + 1, copy)
  }
  return next
}

/** Paste style onto every selected block (whole design, anchor id kept). */
export function pasteStyleToNodes(blocks: SectionNode[], paths: readonly NodePath[], source: BlockStyle): SectionNode[] {
  let next = blocks
  for (const path of paths) {
    if (!isBlockPath(path)) continue
    next = updateNode(next, path, (node) => ({ ...node, design: applyPastedStyle(node.design, source) }))
  }
  return next
}

/** The nodes a bulk copy puts on the clipboard (top-level selection, document order). */
export function nodesForCopy(blocks: SectionNode[], paths: readonly NodePath[]): SectionNode[] {
  const out: SectionNode[] = []
  for (const path of topLevelPaths(paths)) {
    const node = getNode(blocks, path)
    if (node) out.push(node)
  }
  return out
}

/** Splits a selection into editable paths and locked ones (`isBlocked(path)` says whether a lock stops it). */
export function splitLocked(paths: readonly NodePath[], isBlocked: (path: NodePath) => boolean): { allowed: NodePath[]; skipped: NodePath[] } {
  const allowed: NodePath[] = []
  const skipped: NodePath[] = []
  for (const path of paths) (isBlocked(path) ? skipped : allowed).push(path)
  return { allowed, skipped }
}
