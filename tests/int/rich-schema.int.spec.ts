import { describe, expect, it } from 'vitest'

import { jsonLdFor } from '@/fields/schemaType'
import { buildPageJsonLd } from '@/features/seo/pageSchema'
import { buildRichNode, factsError, parseFacts, validateRich } from '@/features/seo/richTypes'

const ctx = { title: 'Page', url: 'https://x.test/p', imageUrl: 'https://x.test/i.jpg', siteName: 'Site' }

describe('rich structured data', () => {
  it('keeps Event as the type for the events collection but a rich node for a post', () => {
    expect(jsonLdFor('events', null, { title: 'E' })).toEqual({ type: 'Event' })
    expect(jsonLdFor('posts', 'Event', { title: 'P' })).toEqual({ type: 'WebPage', rich: 'Event' })
  })

  it('builds an event and lists missing facts', () => {
    const n = buildRichNode('Event', { startDate: '2027-01-05T18:00', location: 'Town Hall', price: 20, eventStatus: 'EventScheduled' }, ctx)
    expect(n).toMatchObject({ '@type': 'Event', name: 'Page', startDate: '2027-01-05T18:00', location: { name: 'Town Hall' }, offers: { price: 20 } })
    expect(validateRich('Event', {}).missing).toEqual(['name', 'startDate', 'location'])
  })

  it('builds a recipe with ingredients, steps and rating', () => {
    const n = buildRichNode('Recipe', { ingredients: 'Flour\nMilk', steps: ['Mix', 'Fry'], prepTime: 'PT10M', ratingValue: 4.5, ratingCount: 12 }, ctx)
    expect(n['@type']).toBe('Recipe')
    expect(n.recipeIngredient).toEqual(['Flour', 'Milk'])
    expect(n.recipeInstructions).toEqual([{ '@type': 'HowToStep', position: 1, text: 'Mix' }, { '@type': 'HowToStep', position: 2, text: 'Fry' }])
    expect(n.image).toBe(ctx.imageUrl)
    expect(n.aggregateRating).toMatchObject({ ratingValue: 4.5, ratingCount: 12 })
  })
  it('builds job, software, review, howto, person and business nodes', () => {
    expect(buildRichNode('JobPosting', { company: 'Acme', location: 'Perth', salaryMin: 90000, currency: 'AUD' }, ctx)).toMatchObject({ '@type': 'JobPosting', hiringOrganization: { name: 'Acme' }, baseSalary: { currency: 'AUD' } })
    expect(buildRichNode('SoftwareApplication', { price: 0, ratingValue: 4 }, ctx)).toMatchObject({ offers: { price: 0 } })
    expect(buildRichNode('Review', { itemName: 'Widget', ratingValue: 4, author: 'Ada' }, ctx)).toMatchObject({ reviewRating: { bestRating: 5 }, author: { name: 'Ada' } })
    expect(buildRichNode('HowTo', { steps: 'a\nb', totalTime: 'PT5M' }, ctx).step).toHaveLength(2)
    expect(buildRichNode('Person', { sameAs: ['https://a.test'] }, ctx)).toMatchObject({ name: 'Page', sameAs: ['https://a.test'] })
    expect(buildRichNode('LocalBusiness', { address: '1 High St', openingHours: ['Mo-Fr 09:00-17:00'] }, ctx)).toMatchObject({ address: { streetAddress: '1 High St' } })
  })
  it('lists missing required and recommended facts', () => {
    const v = validateRich('Recipe', { name: 'x' })
    expect(v.missing).toEqual(['image'])
    expect(v.recommended).toContain('ingredients')
    expect(validateRich('Person', { name: 'Ada' }).missing).toEqual([])
  })
  it('reads and checks the JSON text', () => {
    expect(parseFacts('{"a":1}')).toEqual({ a: 1 })
    expect(parseFacts('nope')).toEqual({})
    expect(parseFacts('[1]')).toEqual({})
    expect(factsError('')).toBe(true)
    expect(factsError('{bad')).toContain('not valid')
    expect(factsError('[]')).toContain('object')
  })
  it('puts the node on the page as mainEntity only when facts exist', () => {
    const base = { collection: 'pages', schemaType: 'Recipe', title: 'Pancakes', url: ctx.url, baseUrl: 'https://x.test', siteName: 'Site' }
    const withFacts = buildPageJsonLd({ ...base, schemaFacts: '{"ingredients":["Flour"]}' })
    expect(withFacts?.['@type']).toBe('WebPage')
    expect((withFacts?.mainEntity as Record<string, unknown>)['@type']).toBe('Recipe')
    expect(buildPageJsonLd({ ...base })?.mainEntity).toBeUndefined()
  })
})

describe('facts editor and page check', () => {
  it('lists form fields for every rich type that match the requirements', async () => {
    const { FACT_FIELDS, RICH_REQUIREMENTS, RICH_TYPES } = await import('@/features/seo/richTypes')
    for (const t of RICH_TYPES) {
      const keys = FACT_FIELDS[t].map((d) => d.key)
      for (const k of [...RICH_REQUIREMENTS[t].must, ...RICH_REQUIREMENTS[t].should]) expect(keys).toContain(k)
    }
  })

  it('adds a missing facts check to the page analysis', async () => {
    const { seoChecks } = await import('@/features/seo/analysis/analyze')
    const base = { title: 'T', slug: 't', metaTitle: 'T', metaDescription: '', keyphrase: '', text: '', headings: [] as { level: number; text: string }[], links: [] as { href: string; internal: boolean }[], images: [] as { alt: string }[] }
    const bad = seoChecks({ ...base, schemaType: 'Recipe', schemaFacts: '{"name":"Pancakes"}' }).find((c) => c.id === 'rich-facts')
    expect(bad?.status).toBe('bad')
    expect(bad?.message).toContain('image')
    expect(seoChecks({ ...base, schemaType: 'WebPage' }).some((c) => c.id === 'rich-facts')).toBe(false)
  })
})
