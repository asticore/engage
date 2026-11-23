import type { SectionNode } from '@/lib/sectionTree'

/**
 * AI edit on any selected element: the model only ever edits sections, so a non-top-level
 * selection is wrapped in a one-column section that carries the node's own id, and the
 * reply is unwrapped back to the blocks that replace the node.
 */
export function wrapForAi(node: SectionNode): SectionNode {
  if (node.blockType === 'section') return node
  return { blockType: 'section', _id: node._id, columns: [{ blocks: [node] }] }
}

/** Blocks that should replace the original node. Nested sections accept the reply as-is. */
export function unwrapAiReplacement(original: SectionNode, sections: SectionNode[]): SectionNode[] {
  if (original.blockType === 'section') return sections
  const out: SectionNode[] = []
  for (const section of sections) {
    if (section.blockType !== 'section') {
      out.push(section)
      continue
    }
    for (const column of section.columns ?? []) out.push(...(column.blocks ?? []))
  }
  return out
}
