import type { SectionNode } from '@/lib/sectionTree'

import { lexicalToPlainText } from './richTextUtil'

/**
 * Task 16h: turn a text block into a list or a table, so a paragraph that is really a list of
 * steps or facts can become a Google featured snippet shape. Pure: node in, new node out.
 * Only plain, unformatted text is converted, and the original text stays readable in the result.
 */

export type ConvertKind = 'bullets' | 'numbers' | 'table'

export const CONVERT_LABELS: Record<ConvertKind, string> = {
  bullets: 'Convert to bulleted list',
  numbers: 'Convert to numbered list',
  table: 'Convert to table',
}

const MARKER = /^\s*(?:[-*•–]|\d+[.)])\s+/

/** The non-empty lines of a text-editor block's content, or [] when the block is not a text block. */
export function textLines(node: SectionNode | undefined): string[] {
  const n = node as unknown as Record<string, unknown> | undefined
  if (!n || n.blockType !== 'element' || n.elementType !== 'text-editor') return []
  const props = n.props && typeof n.props === 'object' ? (n.props as Record<string, unknown>) : null
  if (!props) return []
  return lexicalToPlainText(props.content)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
}

const SEPARATORS = ['|', '\t', ';']

/** The cell separator shared by every line (at least two lines, at least two cells each), or null. */
export function tableSeparator(lines: string[]): string | null {
  if (lines.length < 2) return null
  for (const sep of SEPARATORS) {
    const widths = lines.map((l) => l.split(sep).length)
    if (widths[0] >= 2 && widths.every((w) => w === widths[0])) return sep
  }
  return null
}

/** Which conversions fit this block. Lists need two or more lines; a table needs a shared separator. */
export function convertibleKinds(node: SectionNode | undefined): ConvertKind[] {
  const lines = textLines(node)
  if (lines.length === 0) return []
  const out: ConvertKind[] = []
  if (lines.length >= 2) out.push('bullets', 'numbers')
  if (tableSeparator(lines)) out.push('table')
  return out
}

/** The replacement element for `node`, keeping its id, or null when the conversion does not fit. */
export function convertNode(node: SectionNode, kind: ConvertKind): SectionNode | null {
  if (!convertibleKinds(node).includes(kind)) return null
  const lines = textLines(node)
  const n = node as unknown as Record<string, unknown>
  const base = { blockType: 'element', _id: n._id } as Record<string, unknown>
  if (kind === 'table') {
    const sep = tableSeparator(lines) as string
    const cell = (c: string): string => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
    const rows = lines.map((l) => l.split(sep).map((c) => cell(c.trim())).join(',')).join('\n')
    return { ...base, elementType: 'table', props: { rows, headerRow: true, striped: true } } as unknown as SectionNode
  }
  const items = lines.map((l) => ({ text: l.replace(MARKER, '') }))
  return { ...base, elementType: 'list', props: { items, marker: kind === 'numbers' ? 'numbers' : 'bullets', align: 'left' } } as unknown as SectionNode
}
