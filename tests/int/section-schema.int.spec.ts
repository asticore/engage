import { describe, expect, it } from 'vitest'

import { parseSectionLayout } from '@/lib/sectionLayout'
import { jsonLdString, sectionSchemaJsonLd } from '@/lib/sectionSchema'

const panels = [
  { label: 'How long is delivery?', blocks: [{ blockType: 'element', props: { text: 'Three to five days.' } }] },
  { label: '', blocks: [{ props: { text: 'No title, skipped' } }] },
  { label: 'Returns?', blocks: [{ props: { text: '30 days.' } }] },
]

describe('section FAQ and How-To schema', () => {
  it('builds FAQPage questions from panel titles and text', () => {
    const ld = sectionSchemaJsonLd(panels, 'faq') as { '@type': string; mainEntity: { name: string }[] }
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity.map((q) => q.name)).toEqual(['How long is delivery?', 'Returns?'])
  })
  it('builds numbered HowTo steps', () => {
    const ld = sectionSchemaJsonLd(panels, 'howto') as { step: { position: number }[] }
    expect(ld.step.map((s) => s.position)).toEqual([1, 2])
  })
  it('returns null with no usable panel and escapes the script', () => {
    expect(sectionSchemaJsonLd([{ label: 'x', blocks: [] }], 'faq')).toBeNull()
    expect(jsonLdString({ a: '</script>' })).not.toContain('</script>')
  })
  it('keeps schemaType only on tabs and accordion', () => {
    expect(parseSectionLayout({ display: 'accordion', schemaType: 'faq' })?.schemaType).toBe('faq')
    expect(parseSectionLayout({ display: 'grid', schemaType: 'faq' })?.schemaType).toBeUndefined()
    expect(parseSectionLayout({ display: 'tabs', schemaType: 'evil' })?.schemaType).toBeUndefined()
  })
})
