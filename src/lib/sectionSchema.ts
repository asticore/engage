import { plainText } from '@/features/seo/schemaNodes'

/**
 * FAQ and How-To structured data for a tabs or accordion section. Each panel's title is the question
 * (or step name) and the text inside the panel is the answer (or step text). Pure, no I/O.
 */
export type SectionSchemaType = 'faq' | 'howto'

type Panel = { label?: unknown; blocks?: unknown }

const MAX_ENTRIES = 50

export function sectionSchemaJsonLd(panels: Panel[], type: SectionSchemaType): Record<string, unknown> | null {
  const rows: { name: string; text: string }[] = []
  for (const panel of panels) {
    const name = typeof panel.label === 'string' ? panel.label.replace(/\s+/g, ' ').trim() : ''
    const text = plainText(panel.blocks)
    if (name && text) rows.push({ name, text })
    if (rows.length >= MAX_ENTRIES) break
  }
  if (rows.length === 0) return null
  if (type === 'faq') {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: rows.map((r) => ({ '@type': 'Question', name: r.name, acceptedAnswer: { '@type': 'Answer', text: r.text } })),
    }
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: rows[0].name,
    step: rows.map((r, i) => ({ '@type': 'HowToStep', position: i + 1, name: r.name, text: r.text })),
  }
}

/** JSON for a script tag: "<" is escaped so the data can never close the tag early. */
export const jsonLdString = (node: Record<string, unknown>): string => JSON.stringify(node).replace(/</g, '\\u003c')
