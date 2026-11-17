import { mapNodes, parseColumns, type SectionNode } from '@/lib/sectionTree'

const isBlankCountdown = (node: SectionNode): boolean => {
  if (node.blockType !== 'element' || node.elementType !== 'countdown') return false
  const target = (node.props as { target?: unknown } | undefined)?.target
  return typeof target !== 'string' || target.trim() === ''
}

const fill = (node: SectionNode, launchAt: string): SectionNode => (isBlankCountdown(node) ? { ...node, props: { ...(node.props as object), target: launchAt } } : node)

/**
 * Gives every Countdown element that has no date of its own the site's launch date, so a coming soon template can
 * hold a plain Countdown and always follow the date set under Site pages and maintenance. Pure: returns new nodes.
 * With no launch date the blocks come back unchanged.
 */
export function fillCountdownTargets(blocks: unknown[], launchAt: string | null): unknown[] {
  if (!launchAt) return blocks
  return blocks.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const node = raw as SectionNode
    if (node.blockType === 'section') {
      const columns = parseColumns(node.columns)
      return { ...node, columns: mapNodes(columns, (child) => fill(child, launchAt)) }
    }
    return fill(node, launchAt)
  })
}
