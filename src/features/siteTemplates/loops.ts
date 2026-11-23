/**
 * Named loops in Templates (Task 14, 33f). A loop is a loop item template (the card) plus what fills it (source, filters,
 * order, count). "New loop" makes the card for the source, and "Place on" adds a Loop grid with that query to the blog or
 * shop archive, in place of the plain list. One loop can sit on both with different sources. Pure functions.
 */
import { getElementDef } from '@/lib/elements/registry'
import type { SectionNode } from '@/lib/sectionTree'
import { LOOP_ORDERS, LOOP_SOURCES, type LoopGridOrder } from './loopGrid'

export const LOOP_PLACEMENTS = ['archive-blog', 'archive-shop'] as const
export type LoopPlacement = (typeof LOOP_PLACEMENTS)[number]

export type LoopRequest = {
  name: string
  source: 'posts' | 'products' | 'events'
  category: string
  tag: string
  author: string
  type: string
  orderBy: LoopGridOrder
  count: number
  columns: number
  placeOn: LoopPlacement[]
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const clamp = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : fallback
}

/** Reads an untrusted request body. Returns an error message when the loop cannot be made. */
export function parseLoopRequest(raw: unknown): { ok: true; value: LoopRequest } | { ok: false; error: string } {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const name = text(body.name, 80)
  if (!name) return { ok: false, error: 'Give the loop a name.' }
  const source = (LOOP_SOURCES as readonly string[]).includes(body.source as string) && body.source ? (body.source as LoopRequest['source']) : null
  if (!source) return { ok: false, error: 'Choose what fills the loop: posts, products or events.' }
  const orderBy = (LOOP_ORDERS as readonly string[]).includes(body.orderBy as string) ? (body.orderBy as LoopGridOrder) : 'newest'
  const placeOn = Array.isArray(body.placeOn) ? [...new Set(body.placeOn.filter((p): p is LoopPlacement => (LOOP_PLACEMENTS as readonly string[]).includes(p as string)))] : []
  return {
    ok: true,
    value: {
      name, source, orderBy, placeOn,
      category: text(body.category, 80), tag: text(body.tag, 80), author: text(body.author, 80), type: text(body.type, 80),
      count: clamp(body.count, 9, 1, 48), columns: clamp(body.columns, 3, 1, 4),
    },
  }
}

const el = (elementType: string, props: Record<string, unknown> = {}): SectionNode => ({
  blockType: 'element',
  elementType,
  props: { ...(getElementDef(elementType)?.defaultProps() || {}), ...props },
})
const section = (blocks: SectionNode[]): SectionNode => ({ blockType: 'section', columns: [{ width: 12, blocks }] })

/** The card (loop item template blocks) for a source: picture, title and what matters for that source. */
export function loopCardBlocks(source: LoopRequest['source']): SectionNode[] {
  if (source === 'products') return [section([el('post-featured-image'), el('post-title', { level: 'h3' }), el('product-price')])]
  if (source === 'events') return [section([el('post-featured-image'), el('post-title', { level: 'h3' }), el('post-meta')])]
  return [section([el('post-featured-image'), el('post-title', { level: 'h3' }), el('post-meta'), el('post-excerpt')])]
}

/** A section holding the Loop grid for a saved loop template and the request's query. */
export function loopGridSection(templateId: string | number, request: LoopRequest): SectionNode {
  return section([
    el('loop-grid', {
      loopTemplate: String(templateId), source: request.source, category: request.category, tag: request.tag, author: request.author, type: request.type,
      orderBy: request.orderBy, count: request.count, columns: request.columns, pagination: true,
    }),
  ])
}

const onlyContentSlot = (node: SectionNode): boolean => {
  const columns = (node as { columns?: Array<{ blocks?: SectionNode[] }> }).columns
  if (node.blockType !== 'section' || !Array.isArray(columns)) return false
  const children = columns.flatMap((column) => column.blocks ?? [])
  return children.length > 0 && children.every((child) => (child as { elementType?: string }).elementType === 'content-slot')
}

/**
 * Puts a loop section on an archive template's blocks: replaces the section that holds only the plain list (the content
 * slot), or is added at the end when there is none. A loop already placed (same template id) is not added twice.
 */
export function placeLoopOnArchive(blocks: SectionNode[], gridSection: SectionNode): { blocks: SectionNode[]; replaced: boolean; already: boolean } {
  const grid = JSON.stringify(gridSection).match(/"loopTemplate":"([^"]*)"/)?.[1]
  if (grid && blocks.some((node) => JSON.stringify(node).includes(`"loopTemplate":"${grid}"`))) return { blocks, replaced: false, already: true }
  const index = blocks.findIndex(onlyContentSlot)
  if (index === -1) return { blocks: [...blocks, gridSection], replaced: false, already: false }
  return { blocks: [...blocks.slice(0, index), gridSection, ...blocks.slice(index + 1)], replaced: true, already: false }
}
