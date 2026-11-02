/**
 * Starter page templates a feature brings when it is switched on for the first
 * time. Each is created once, by name (an existing template with that name is
 * left alone, so a site that already made its own is never doubled up).
 * The core starters (home page, three general templates) are seeded at install
 * by src/seed/seedHomeAndTemplates.ts.
 */

import type { Engine } from '@/engine'

import type { FeatureKey } from './registry'

type Starter = { name: string; description: string; blocks: Record<string, unknown>[] }

export const FEATURE_STARTERS: Partial<Record<FeatureKey, Starter[]>> = {
  ecommerce: [
    {
      name: 'Shop landing',
      description: 'Hero, a product grid and a call-to-action banner for a shop front page.',
      blocks: [
        { blockType: 'hero', heading: 'Shop the collection' },
        { blockType: 'productGrid', heading: 'Featured products', limit: 8 },
        { blockType: 'ctaBanner', heading: 'Free delivery over the minimum order', buttonLabel: 'Browse all', buttonUrl: '/shop', style: 'dark' },
      ],
    },
  ],
  events: [
    {
      name: 'Events landing',
      description: 'Hero and the upcoming events grid.',
      blocks: [{ blockType: 'hero', heading: 'What is on' }, { blockType: 'eventGrid', heading: 'Upcoming events' }],
    },
  ],
  faq: [
    {
      name: 'FAQ page',
      description: 'Hero and the frequently asked questions.',
      blocks: [{ blockType: 'hero', heading: 'Questions and answers' }, { blockType: 'faq', heading: 'Frequently asked questions', source: 'category' }],
    },
  ],
}

/** Creates the feature's starter templates that do not exist yet. Never throws. */
export async function seedFeatureStarters(engine: Engine, key: FeatureKey): Promise<number> {
  let created = 0
  for (const starter of FEATURE_STARTERS[key] ?? []) {
    try {
      const existing = await engine.find({ collection: 'page-templates', overrideAccess: true, limit: 1, depth: 0, where: { name: { equals: starter.name } } })
      if (existing.totalDocs > 0) continue
      await engine.create({ collection: 'page-templates', overrideAccess: true, data: starter as never })
      created += 1
    } catch (error) {
      engine.logger.warn(`[provision] Could not create the "${starter.name}" starter: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return created
}
