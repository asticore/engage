import type { Engine } from '@/engine'
import { modernizeBlocks } from '@/features/legacyBlocks/convertTree'

// Shared, idempotent seed logic for the starter Home page + Page Templates.
// Used by BOTH:
//  - the dev/local migration (src/migrations/20260822_120000_seed_home_and_templates.ts),
//    which runs fine against a local emulated D1 via the CLI migrate command
//  - the /api/internal-seed route (see src/app/(engage)/api/internal-seed/route.ts),
//    which is hit over real HTTP against the deployed Worker so it runs with genuine
//    production D1 bindings - the CLI migrate command in CI can only ever reach a local
//    emulated database (see the note on the D1 binding in wrangler.jsonc), so this is
//    the mechanism that actually seeds real production data on deploy.
//
// Fully idempotent - safe to call any number of times against a database that
// already has a homepage and/or templates (it just skips whatever exists).

export const lexicalParagraph = (text: string) => ({
  root: {
    type: 'root',
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        children: [{ type: 'text', version: 1, text, format: 0, style: '', mode: 'normal', detail: 0 }],
      },
    ],
  },
})

export async function seedHomeAndTemplates(
  engine: Engine,
): Promise<{ homeCreated: boolean; templatesCreated: boolean }> {
  let homeCreated = false
  let templatesCreated = false

  // ---- Home page ----
  const { totalDocs: homepageCount } = await engine.find({
    collection: 'pages',
    overrideAccess: true,
    where: { isHomepage: { equals: true } },
    limit: 1,
    depth: 0,
  })

  if (homepageCount === 0) {
    // The starter hero names the site from Site Settings. Read only when the Home page is created (once per install),
    // through the shared snapshot; a blank or missing name falls back to the neutral default.
    // The starter site is blank: an empty published Home page, so there is always a page to edit. The setup questionnaire
    // can fill it with an example the owner picks (see /api/template-libraries/install-example).
    await engine.create({
      collection: 'pages',
      overrideAccess: true,
      data: { title: 'Home', slug: 'home', isHomepage: true, _status: 'published', blocks: [] },
    })
    engine.logger.info('[seed] Created and published Home page.')
    homeCreated = true
  } else {
    engine.logger.info('[seed] Home page already exists - skipping.')
  }

  // ---- Starter Page Templates ----
  const { totalDocs: templateCount } = await engine.find({
    collection: 'page-templates',
    overrideAccess: true,
    limit: 1,
    depth: 0,
  })

  if (templateCount === 0) {
    await engine.create({
      collection: 'page-templates',
      overrideAccess: true,
      data: {
        name: 'Homepage Starter',
        description: 'Hero, intro copy, a product grid, and a call-to-action banner - a full landing page in one click.',
        blocks: modernizeBlocks([
          { blockType: 'hero', heading: 'Your headline here', subheading: 'A short supporting line about the brand.' },
          { blockType: 'richText', content: lexicalParagraph('Write an introduction to your brand or offer here.') },
          { blockType: 'productGrid', heading: 'Featured products', limit: 4 },
          {
            blockType: 'ctaBanner',
            heading: 'Call to action',
            text: 'A reason to click the button below.',
            buttonLabel: 'Shop now',
            buttonUrl: '/shop',
            style: 'dark',
          },
        ]),
      },
    })

    await engine.create({
      collection: 'page-templates',
      overrideAccess: true,
      data: {
        name: 'About / Story',
        description: 'Hero, a longer story section, and an FAQ - good for About or brand-story pages.',
        blocks: modernizeBlocks([
          { blockType: 'hero', heading: 'Our story' },
          {
            blockType: 'richText',
            content: lexicalParagraph(
              'Tell the story of the brand, the people behind it, and what makes it different.',
            ),
          },
          { blockType: 'faq', heading: 'Frequently asked questions', source: 'category' },
        ]),
      },
    })

    await engine.create({
      collection: 'page-templates',
      overrideAccess: true,
      data: {
        name: 'Simple Landing',
        description: 'A minimal one-section landing page - hero plus a single call-to-action banner.',
        blocks: modernizeBlocks([
          { blockType: 'hero', heading: 'Your headline here' },
          { blockType: 'ctaBanner', heading: 'Ready to get started?', buttonLabel: 'Get started', buttonUrl: '/', style: 'light' },
        ]),
      },
    })

    engine.logger.info('[seed] Created 3 starter page templates.')
    templatesCreated = true
  } else {
    engine.logger.info('[seed] Page templates already exist - skipping.')
  }

  return { homeCreated, templatesCreated }
}
