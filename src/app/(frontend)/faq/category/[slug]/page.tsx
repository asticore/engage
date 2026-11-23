import { notFound } from 'next/navigation'
import React from 'react'
import type { Metadata } from 'next'

import { FaqBrowser } from '@/features/faq/FaqBrowser'
import { faqTypes, faqTypePath, filterFaqs } from '@/features/faq/archive'
import { currentRequestLocale, applyTranslationsToDocs } from '@/features/multilingual/applyTranslations'
import { buildFaqPageJsonLd } from '@/features/seo/pageSchema'
import { getSeoContext } from '@/features/seo/settings'
import { getEngine } from '@/lib/engine'
import { buildMetadata } from '@/utilities/seo'
import { getFeatureFlags } from '@/utilities/features'
import type { Faq, FaqSetting } from '@/engage-types'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

async function load() {
  const engine = await getEngine()
  const [settings, { docs }] = (await Promise.all([
    engine.findGlobal({ slug: 'faq-settings' }).catch((): null => null),
    engine.find({ collection: 'faqs', sort: 'order', limit: 200 }),
  ])) as unknown as [FaqSetting | null, { docs: Faq[] }]
  return { settings, faqs: await applyTranslationsToDocs(docs, 'faqs', await currentRequestLocale()) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { faqs } = await load()
  const type = faqTypes(faqs).find((t) => t.slug === slug)
  return buildMetadata({ title: type ? `${type.name} questions` : 'FAQ', path: faqTypePath(slug) })
}

export default async function FaqCategoryPage({ params, searchParams }: Props) {
  const flags = await getFeatureFlags()
  if (!flags.faq) notFound()
  const { slug } = await params
  const rawQ = (await searchParams).q
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ || '').trim().slice(0, 200)
  const { settings, faqs } = await load()
  const types = faqTypes(faqs)
  const type = types.find((t) => t.slug === slug)
  if (!type) notFound()
  const inType = filterFaqs(faqs, { type: slug })
  const seo = await getSeoContext()
  const node = seo.enabled ? buildFaqPageJsonLd({ url: `${seo.baseUrl}${faqTypePath(slug)}`, name: `${type.name} questions`, faqs: inType }) : null
  return (
    <div className="page-shell">
      <div className="section-heading">
        <p className="text-sm opacity-70"><a href="/faq">{settings?.pageTitle || 'FAQ'}</a></p>
        <h1>{type.name}</h1>
      </div>
      {node && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replaceAll('</', '<\\/') }} />}
      <FaqBrowser faqs={filterFaqs(faqs, { type: slug, q })} types={types} q={q} activeSlug={slug} layout={settings?.layout || 'accordion'} groupByCategory={false} />
    </div>
  )
}
