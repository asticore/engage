import { getElementDef } from '@/lib/elements/registry'
import type { SectionNode } from '@/lib/sectionTree'

export type ExamplePresetCard = { id: string; label: string; description: string }

const el = (elementType: string, props: Record<string, unknown> = {}): SectionNode => ({
  blockType: 'element',
  elementType,
  props: { ...(getElementDef(elementType)?.defaultProps() || {}), ...props },
})

const one = (blocks: SectionNode[]): SectionNode => ({ blockType: 'section', columns: [{ width: 12 as const, blocks }] })

type Preset = ExamplePresetCard & { build: () => SectionNode }

/** Ready-made sections built from existing elements; effects stay options on those elements. */
const PRESETS: Preset[] = [
  {
    id: 'number-box',
    label: 'Number box',
    description: 'A big counting number with a title under it.',
    build: () => one([el('counter', { number: 1200, suffix: '+', title: 'Happy customers', animate: true })]),
  },
  {
    id: 'ticket-card',
    label: 'Ticket and offer card',
    description: 'An offer card with a title, details and a claim button.',
    build: () =>
      one([
        el('card', { title: 'Spring offer', text: 'Save 20% on your first order. Use the code at checkout.', align: 'centre', hoverEffect: 'lift', shadow: 'md' }),
        el('button', { text: 'Claim offer', url: '/shop', variant: 'primary', align: 'center' }),
      ]),
  },
  {
    id: 'promo-box',
    label: 'Promo box',
    description: 'A highlighted box with a heading, a line of text and a button.',
    build: () =>
      one([
        el('heading', { text: 'Join today', tag: 'h2', align: 'center' }),
        el('text', { text: 'A short line that tells people why to act now.' }),
        el('button', { text: 'Get started', url: '/contact', variant: 'primary', align: 'center' }),
      ]),
  },
  {
    id: 'blog-sidebar',
    label: 'Blog sidebar',
    description: 'Categories as a list and tags as a cloud, for a blog page side column.',
    build: () =>
      one([
        el('heading', { text: 'Categories', tag: 'h3', align: 'left' }),
        el('taxonomy-list', { kind: 'categories', layout: 'list', showCount: true }),
        el('heading', { text: 'Tags', tag: 'h3', align: 'left' }),
        el('taxonomy-list', { kind: 'tags', layout: 'cloud', orderBy: 'count' }),
      ]),
  },
  {
    id: 'icon-label',
    label: 'Icon label',
    description: 'A small icon with a short label beside it.',
    build: () => one([el('card', { media: 'icon', icon: 'star', title: 'Label', text: '', layout: 'left', iconSize: 28, shadow: 'none', bgColour: 'transparent' })]),
  },
]

export function examplePresetCards(): ExamplePresetCard[] {
  return PRESETS.map(({ id, label, description }) => ({ id, label, description }))
}

export function filterExamplePresetCards(cards: ExamplePresetCard[], query: string): ExamplePresetCard[] {
  const needle = query.trim().toLowerCase()
  return cards.filter((c) => !needle || c.label.toLowerCase().includes(needle) || c.description.toLowerCase().includes(needle))
}

export function examplePresetNode(id: string): SectionNode | null {
  return PRESETS.find((p) => p.id === id)?.build() ?? null
}
