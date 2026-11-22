import type { EditorField } from './fieldTypes'
import type { ElementDef } from './registry'

/**
 * Element versions of the legacy grid blocks (Event grid, FAQ, Product grid). They draw exactly what the old blocks
 * drew (the renderers reuse the same components), so converting a page with the Legacy blocks tool (Task 13 / 32b)
 * changes nothing visitors see. Server rendered (SITE_ELEMENT_TYPES); renderers:
 * src/components/blocks/elements/LegacyReplacementServer.tsx.
 */
const text = (name: string, label: string, extra: Partial<EditorField> = {}): EditorField => ({ name, label, type: 'text', ...extra })

export const LEGACY_REPLACEMENT_ELEMENTS: ElementDef[] = [
  {
    type: 'event-grid', label: 'Event grid', icon: String.fromCodePoint(0x1f4c5), category: 'siteMeta',
    description: 'Cards for upcoming events (or recent past events), soonest first. Shows nothing when there are none.',
    fields: [
      text('heading', 'Heading'),
      { name: 'showPast', label: 'Show recent past events instead of upcoming ones', type: 'checkbox' },
      { name: 'limit', label: 'How many (1-24)', type: 'range', width: 'half', min: 1, max: 24, step: 1 },
    ],
    defaultProps: () => ({ heading: 'Events', showPast: false, limit: 3 }),
  },
  {
    type: 'faq-list', label: 'FAQ', icon: String.fromCodePoint(0x2753), category: 'siteMeta',
    description: 'An accordion of your FAQ entries, all of one category or hand-picked. The questions also feed the page\'s FAQ structured data.',
    fields: [
      text('heading', 'Heading'),
      { name: 'source', label: 'Show', type: 'select', width: 'half', options: [{ label: 'All FAQs in a category', value: 'category' }, { label: 'Hand-picked FAQs', value: 'manual' }] },
      text('category', 'Category', { helpText: 'Matches the Category field on the FAQ entries. Leave blank to show all FAQs.', showIf: { field: 'source', in: ['', 'category'] } }),
      text('faqs', 'FAQ ids', { helpText: 'The ids of the FAQ entries to show, separated by commas.', showIf: { field: 'source', equals: 'manual' } }),
    ],
    defaultProps: () => ({ heading: 'Frequently asked questions', source: 'category', category: '', faqs: '' }),
  },
  {
    type: 'product-grid', label: 'Product grid', icon: String.fromCodePoint(0x1f6d2), category: 'commerce',
    description: 'Cards for your newest published products, all or from one category. Shows nothing when there are none.',
    fields: [
      text('heading', 'Heading'),
      text('category', 'Category', { helpText: 'Leave blank to show products from every category.' }),
      { name: 'limit', label: 'How many (1-24)', type: 'range', width: 'half', min: 1, max: 24, step: 1 },
    ],
    defaultProps: () => ({ heading: '', category: '', limit: 4 }),
  },
]
