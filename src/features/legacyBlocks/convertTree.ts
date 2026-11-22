/**
 * Whole-document conversion of legacy blocks (Task 13 / 32b). Pure: no database, no editor.
 *
 * Walks a stored block list, including the blocks inside a section's columns at any depth, counts every legacy
 * block and replaces each one with the section tree convertLegacyBlock() builds. A document with no legacy block
 * comes back unchanged (same objects), so running it twice is a no-op.
 */

import { canConvertLegacy, convertLegacyBlock, LEGACY_BLOCK_TYPES } from '@/views/visualEditor/convertLegacy'

export type LegacyType = (typeof LEGACY_BLOCK_TYPES)[number]
export type LegacyCounts = Partial<Record<LegacyType, number>>

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** Drops the storage bookkeeping a block read from the database carries, so it cannot leak into the new section. */
function stripStorageKeys(block: Rec): Rec {
  const { id: _id, blockName: _name, _order: _o, _parentID: _p, _path: _pa, ...rest } = block
  void _id
  void _name
  void _o
  void _p
  void _pa
  return rest
}

const bump = (counts: LegacyCounts, type: string): void => {
  const key = type as LegacyType
  counts[key] = (counts[key] ?? 0) + 1
}

/** Counts legacy blocks in a stored block list (nested ones included). */
export function countLegacy(blocks: unknown): LegacyCounts {
  const counts: LegacyCounts = {}
  const visit = (list: unknown): void => {
    if (!Array.isArray(list)) return
    for (const node of list) {
      if (!isRec(node)) continue
      if (typeof node.blockType === 'string' && canConvertLegacy(node.blockType)) bump(counts, node.blockType)
      if (node.blockType === 'section') visitColumns(node.columns)
    }
  }
  const visitColumns = (columns: unknown): void => {
    if (!Array.isArray(columns)) return
    for (const column of columns) if (isRec(column)) visit(column.blocks)
  }
  visit(blocks)
  return counts
}

export type TreeConversion = {
  blocks: unknown
  converted: LegacyCounts
  /** Legacy blocks the converter could not turn into sections; they are left exactly as they were. */
  skipped: number
  changed: boolean
}

/** Converts every legacy block in the list. Anything that cannot be converted stays as it was. */
export function convertLegacyTree(blocks: unknown): TreeConversion {
  const converted: LegacyCounts = {}
  let skipped = 0

  const convertList = (list: unknown[]): unknown[] =>
    list.map((node) => {
      if (!isRec(node)) return node
      if (typeof node.blockType === 'string' && canConvertLegacy(node.blockType)) {
        const section = convertLegacyBlock(stripStorageKeys(node))
        if (!section) {
          skipped += 1
          return node
        }
        bump(converted, node.blockType)
        return typeof node._id === 'string' ? { ...section, _id: node._id } : section
      }
      if (node.blockType === 'section' && Array.isArray(node.columns)) {
        const columns = convertColumns(node.columns)
        return columns === node.columns ? node : { ...node, columns }
      }
      return node
    })

  const convertColumns = (columns: unknown[]): unknown[] => {
    let changed = false
    const next = columns.map((column) => {
      if (!isRec(column) || !Array.isArray(column.blocks)) return column
      const before = JSON.stringify(column.blocks)
      const blocks = convertList(column.blocks)
      if (JSON.stringify(blocks) === before) return column
      changed = true
      return { ...column, blocks }
    })
    return changed ? next : columns
  }

  if (!Array.isArray(blocks)) return { blocks, converted, skipped, changed: false }
  const next = convertList(blocks)
  const changed = Object.keys(converted).length > 0
  return { blocks: changed ? next : blocks, converted, skipped, changed }
}

/** Adds up counts from several documents. */
export function addCounts(into: LegacyCounts, from: LegacyCounts): LegacyCounts {
  for (const [type, n] of Object.entries(from)) into[type as LegacyType] = (into[type as LegacyType] ?? 0) + (n ?? 0)
  return into
}

export const totalOf = (counts: LegacyCounts): number => Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0)

/** Converts the legacy blocks of a list that is built into the product (starters, seeds, presets), so new content never creates them. */
export function modernizeBlocks<T>(blocks: T[]): T[] {
  return convertLegacyTree(blocks).blocks as T[]
}
