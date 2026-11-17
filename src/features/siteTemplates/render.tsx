import React from 'react'

import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import { parseColumns, walkNodes, type SectionNode } from '@/lib/sectionTree'

import { prepareTemplateBlocks, resolveSiteTemplate } from './resolve'
import { setTemplateSlot } from './slot'
import type { SiteTemplateKind, TemplateContext } from './types'

const isSlot = (node: SectionNode): boolean => node.blockType === 'element' && node.elementType === 'content-slot'

/** True when the "Template content" element appears anywhere in the blocks, including inside sections. */
export function hasContentSlot(blocks: unknown[]): boolean {
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue
    const node = raw as SectionNode
    if (isSlot(node)) return true
    if (node.blockType === 'section') {
      let found = false
      walkNodes(parseColumns(node.columns), (child) => {
        if (isSlot(child)) found = true
      })
      if (found) return true
    }
  }
  return false
}

/** Template blocks as rendered nodes. The key falls back to the index so the list is stable. */
export const renderTemplateBlocks = (blocks: unknown[]): React.ReactNode =>
  blocks.map((block, index) => {
    const id = block && typeof block === 'object' ? (block as { id?: unknown }).id : undefined
    return <BlockRenderer key={typeof id === 'string' || typeof id === 'number' ? id : index} block={block} index={index} />
  })

/**
 * Wraps a page body in the best matching site template. With no matching template, or on any error,
 * `content` comes back untouched.
 */
export async function renderWithTemplate(args: { kind: SiteTemplateKind; ctx?: TemplateContext; content: React.ReactNode; /** Changes the template's blocks before they draw (the screen templates fill the launch date). */ transformBlocks?: (blocks: unknown[]) => unknown[]; /** With no content slot, draw only the template (the screen templates replace the built-in screen). */ replaceContent?: boolean }): Promise<React.ReactNode> {
  const { content } = args
  try {
    const { kind, ctx = {} } = args
    const template = await resolveSiteTemplate(kind, ctx)
    if (!template) return content
    const prepared = await prepareTemplateBlocks(template)
    const blocks = args.transformBlocks ? args.transformBlocks(prepared) : prepared
    if (blocks.length === 0) return content
    setTemplateSlot(content)
    const rendered = renderTemplateBlocks(blocks)
    if (hasContentSlot(blocks)) return <div className="site-template" data-template-kind={kind}>{rendered}</div>
    if (args.replaceContent) return <div className="site-template" data-template-kind={kind}>{rendered}</div>
    return (
      <div className="site-template" data-template-kind={kind}>
        {rendered}
        {content}
      </div>
    )
  } catch {
    return content
  }
}