/**
 * Builds the Lexical rich text for a post from the reviewed outline and sections.
 * Pure. Uses the same node builders as the content importer, so the stored shape matches.
 */

import {
  lexicalRoot,
  heading,
  listItem,
  listNode,
  paragraph,
  textNode,
  type LexicalNode,
} from '@/features/importContent/lexical'

import type { BlogOutlineItem } from './request'

/** One paragraph or list block from a section's text. Lines inside a paragraph are joined with a space. */
export function blockNodes(sectionText: string): LexicalNode[] {
  const nodes: LexicalNode[] = []
  for (const block of sectionText.split(/\n\s*\n/)) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    if (lines.every((line) => line.startsWith('- '))) {
      nodes.push(
        listNode(
          false,
          lines.map((line) => listItem([textNode(line.slice(2).trim())])),
        ),
      )
    } else {
      nodes.push(paragraph([textNode(lines.join(' ').replace(/^- /, ''))]))
    }
  }
  return nodes
}

/** The source numbers cited in the text ([1], [2]...), ascending, that name one of the given sources. */
export function citedSourceNumbers(sections: string[], sourceCount: number): number[] {
  const used = new Set<number>()
  for (const text of sections) {
    for (const match of text.matchAll(/\[(\d{1,3})\]/g)) {
      const n = Number(match[1])
      if (n >= 1 && n <= sourceCount) used.add(n)
    }
  }
  return [...used].sort((a, b) => a - b)
}

/**
 * The post body: each outline heading as h2, then its section text. When the text cites sources, a closing
 * "Sources" list follows with only the cited ones, numbered as in the text.
 */
export function postContent(
  outline: BlogOutlineItem[],
  sections: string[],
  sources: string[] = [],
): Record<string, unknown> {
  const nodes: LexicalNode[] = []
  outline.forEach((item, index) => {
    nodes.push(heading('h2', [textNode(item.heading)]))
    nodes.push(...blockNodes(sections[index] ?? ''))
  })
  const cited = citedSourceNumbers(sections, sources.length)
  if (cited.length > 0) {
    nodes.push(heading('h2', [textNode('Sources')]))
    nodes.push(listNode(false, cited.map((n) => listItem([textNode(`[${n}] ${sources[n - 1]}`)]))))
  }
  return lexicalRoot(nodes)
}
