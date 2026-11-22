import type { Field } from '@/engine'
import { RICH_TYPES, factsError, isRichType } from '@/features/seo/richTypes'

/**
 * "Page type" for SEO structured data (JSON-LD), chosen per document in the
 * edit screen's right panel. Modelled on Yoast's page types.
 *
 * The stored value is one of the `value`s below; `null` / empty means "use the
 * default for this content type". `jsonLdFor` turns a stored value into the
 * schema.org `@type` (and any extra properties) that `buildPageJsonLd` emits.
 */

export type SchemaTypeOption = { label: string; value: string }

export const PAGE_SCHEMA_TYPES: SchemaTypeOption[] = [
  { label: 'Web page (default)', value: 'WebPage' },
  { label: 'About page', value: 'AboutPage' },
  { label: 'Contact page', value: 'ContactPage' },
  { label: 'FAQ page', value: 'FAQPage' },
  { label: 'Q&A page', value: 'QAPage' },
  { label: 'Profile page', value: 'ProfilePage' },
  { label: 'Collection page (category or listing)', value: 'CollectionPage' },
  { label: 'Item page', value: 'ItemPage' },
  { label: 'Checkout page', value: 'CheckoutPage' },
  { label: 'Search results page', value: 'SearchResultsPage' },
  { label: 'Menu page (restaurant or cafe)', value: 'MenuPage' },
  { label: 'Local business page', value: 'LocalBusinessPage' },
  { label: 'Recipe', value: 'Recipe' },
  { label: 'Job posting', value: 'JobPosting' },
  { label: 'How-to', value: 'HowTo' },
  { label: 'Software application', value: 'SoftwareApplication' },
  { label: 'Review', value: 'Review' },
  { label: 'Person', value: 'Person' },
  { label: 'Local business', value: 'LocalBusiness' },
]

export const POST_SCHEMA_TYPES: SchemaTypeOption[] = [
  { label: 'Blog post (default)', value: 'BlogPosting' },
  { label: 'Article', value: 'Article' },
  { label: 'News article', value: 'NewsArticle' },
  { label: 'Recipe', value: 'Recipe' },
  { label: 'How-to', value: 'HowTo' },
  { label: 'Review', value: 'Review' },
  { label: 'Event', value: 'Event' },
]

export const PRODUCT_SCHEMA_TYPES: SchemaTypeOption[] = [{ label: 'Product (default)', value: 'Product' }]

export const EVENT_SCHEMA_TYPES: SchemaTypeOption[] = [{ label: 'Event (default)', value: 'Event' }]

export const COURSE_SCHEMA_TYPES: SchemaTypeOption[] = [{ label: 'Course (default)', value: 'Course' }]

/** Options per collection slug. Collections without an entry have no page type. */
export const SCHEMA_TYPES_BY_COLLECTION: Record<string, SchemaTypeOption[]> = {
  pages: PAGE_SCHEMA_TYPES,
  posts: POST_SCHEMA_TYPES,
  products: PRODUCT_SCHEMA_TYPES,
  events: EVENT_SCHEMA_TYPES,
  courses: COURSE_SCHEMA_TYPES,
}

/** The type used when a document has not chosen one. */
export const DEFAULT_SCHEMA_TYPE: Record<string, string> = {
  pages: 'WebPage',
  posts: 'BlogPosting',
  products: 'Product',
  events: 'Event',
  courses: 'Course',
}

/**
 * The `schemaType` field for a collection. Lives in the right-hand panel's
 * "Page type" box (the edit screen pulls it out by name), not in the settings card.
 */
export const schemaTypeField = (collection: keyof typeof SCHEMA_TYPES_BY_COLLECTION): Field => {
  const options = SCHEMA_TYPES_BY_COLLECTION[collection]
  const defaultType = DEFAULT_SCHEMA_TYPE[collection]
  const defaultLabelRaw = options.find((o) => o.value === defaultType)?.label || defaultType
  // Strip trailing " (default)" from the option label for a cleaner placeholder
  const defaultLabel = defaultLabelRaw.endsWith(' (default)') ? defaultLabelRaw.slice(0, -10) : defaultLabelRaw
  const placeholderText = `Default (${defaultLabel})`

  return {
    name: 'schemaType',
    type: 'select',
    label: 'Page type',
    options,
    admin: {
      placeholder: placeholderText,
      description: 'Tells search engines what kind of page this is. Used for structured data. Leave as the default if unsure.',
    },
  } as Field
}

/** Facts for Recipe, Job posting and the other rich types, as a JSON object. Only shown for those types. */
export const schemaFactsField = (): Field =>
  ({
    name: 'schemaFacts',
    type: 'textarea',
    label: 'Page type facts',
    validate: (value: unknown) => factsError(value),
    admin: {
      description: 'Facts for the chosen page type. Missing items are listed in the page checks.',
      condition: (data: Record<string, unknown>) => isRichType(data?.schemaType),
      components: { Field: '@/fields/schemaFacts/SchemaFactsField#SchemaFactsField' },
    },
  }) as Field

export type JsonLdTypeInfo = { type: string; extra?: Record<string, unknown>; rich?: (typeof RICH_TYPES)[number] }

/**
 * Maps a stored page type to the schema.org `@type` plus any extra properties.
 * Unknown or empty values fall back to the content type's default.
 */
export const jsonLdFor = (collection: string, value: string | null | undefined, ctx: { title: string; siteName?: string; url?: string }): JsonLdTypeInfo => {
  const allowed = SCHEMA_TYPES_BY_COLLECTION[collection]?.map((option) => option.value) ?? []
  const chosen = value && allowed.includes(value) ? value : DEFAULT_SCHEMA_TYPE[collection] ?? 'WebPage'

  if (chosen === 'MenuPage') {
    return { type: 'WebPage', extra: { mainEntity: { '@type': 'Menu', name: ctx.title } } }
  }
  if (chosen === 'LocalBusinessPage') {
    return {
      type: 'WebPage',
      extra: { about: { '@type': 'LocalBusiness', name: ctx.siteName || ctx.title, ...(ctx.url ? { url: ctx.url } : {}) } },
    }
  }
  // The events collection's own default is Event; only a chosen rich type on pages and posts becomes the mainEntity.
  if (isRichType(chosen) && chosen !== DEFAULT_SCHEMA_TYPE[collection]) return { type: 'WebPage', rich: chosen }
  return { type: chosen }
}
