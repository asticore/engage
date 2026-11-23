import { notFound } from 'next/navigation'
import React from 'react'
import type { Metadata } from 'next'

import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import { FaqBrowser } from '@/features/faq/FaqBrowser'
import { faqTypes, filterFaqs } from '@/features/faq/archive'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'
import { currentRequestLocale, applyTranslations, applyTranslationsToDocs } from '@/features/multilingual/applyTranslations'
import { buildMetadata } from '@/utilities/seo'
import { buildFaqPageJsonLd } from '@/features/seo/pageSchema'
import { getSeoContext } from '@/features/seo/settings'
import type { Faq, FaqSetting } from '@/engage-types'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const engine = await getEngine()
  const settings = (await engine.findGlobal({ slug: 'faq-settings' }).catch((): null => null)) as FaqSetting | null
  return buildMetadata({ title: settings?.pageTitle || 'FAQ', path: '/faq' })
}

export default async function FaqPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawQ = (await searchParams).q
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ || '').trim().slice(0, 200)
  const flags = await getFeatureFlags()
  if (!flags.faq) notFound()

  const engine = await getEngine()
  const [settings, { docs: rawFaqs }] = (await Promise.all([
    engine.findGlobal({ slug: 'faq-settings' }).catch((): null => null),
    engine.find({ collection: 'faqs', sort: 'order', limit: 200 }),
  ])) as unknown as [FaqSetting | null, { docs: Faq[] }]
  const faqs = await applyTranslationsToDocs(rawFaqs, 'faqs', await currentRequestLocale())

  // FAQPage structured data for every question on this page (same answers as the list below).
  const seoContext = await getSeoContext()
  const faqNode = seoContext.enabled ? buildFaqPageJsonLd({ url: `${seoContext.baseUrl}/faq`, name: settings?.pageTitle || 'Frequently Asked Questions', faqs }) : null

  return (
    <div className="page-shell">
      {settings?.introBlocks && settings.introBlocks.length > 0 ? (
        settings.introBlocks.map((block, index) => <BlockRenderer key={block.id || index} block={block} index={index} />)
      ) : (
        <div className="section-heading">
          <h1>{settings?.pageTitle || 'Frequently Asked Questions'}</h1>
        </div>
      )}
      {settings?.intro && <p className="mb-8 max-w-[640px] opacity-80">{settings.intro}</p>}
      {faqNode && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqNode).replaceAll('</', '<\\/') }} />}

      <FaqBrowser faqs={filterFaqs(faqs, { q })} types={faqTypes(faqs)} q={q} layout={settings?.layout || 'accordion'} groupByCategory={settings?.groupByCategory !== false} />
    </div>
  )
}
