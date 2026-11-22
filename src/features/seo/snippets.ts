/**
 * Featured snippets and rich results (Task 6, item 16n). A data-driven catalogue taken from Google Search
 * Central's "Structured data markup that Google Search supports" gallery. Add a row to add a type; nothing
 * else needs to change. Detection reads the page's HTML facts: JSON-LD blocks for markup types, and the content
 * itself (a short answer under a question heading, a real list, a real table) for the three that need no markup.
 */

import type { HtmlFacts } from './crawl/htmlFacts'

export type SnippetKind = 'content' | 'markup'

export type SnippetType = {
  id: string
  label: string
  kind: SnippetKind
  /** The schema.org @type values that count as this snippet. */
  schemaTypes?: string[]
  /** Properties Google requires; a block without one has errors. */
  required?: string[]
  /** Properties Google recommends; a block without one has warnings. */
  recommended?: string[]
  /** True when Google no longer shows the rich result, so this is markup only. */
  markupOnly?: boolean
  /** How to add the type when it is missing. */
  howTo: string
}

export const SNIPPET_TYPES: readonly SnippetType[] = [
  { id: 'paragraph', label: 'Paragraph (short answer)', kind: 'content', howTo: 'Put a question in a heading, then answer it in one short paragraph (about 40 to 60 words) straight underneath.' },
  { id: 'list', label: 'Bullet or numbered list', kind: 'content', howTo: 'Use a real bullet or numbered list for steps or items. Do not fake a list with line breaks.' },
  { id: 'table', label: 'Table', kind: 'content', howTo: 'Use a real table with header cells for comparisons and figures.' },
  { id: 'video', label: 'Video', kind: 'markup', schemaTypes: ['VideoObject'], required: ['name', 'thumbnailUrl', 'uploadDate'], recommended: ['description', 'contentUrl', 'embedUrl', 'duration'], howTo: 'Add a video element and VideoObject markup with a name, thumbnail and upload date.' },
  { id: 'faq', label: 'FAQ (markup only)', kind: 'markup', schemaTypes: ['FAQPage'], required: ['mainEntity'], markupOnly: true, howTo: 'Add an FAQ section; its markup is for understanding only, because Google now limits the FAQ rich result.' },
  { id: 'howto', label: 'How-to (markup only)', kind: 'markup', schemaTypes: ['HowTo'], required: ['name', 'step'], markupOnly: true, howTo: 'Add step by step content; its markup is for understanding only, because Google now limits the How-to rich result.' },
  { id: 'article', label: 'Article', kind: 'markup', schemaTypes: ['Article', 'NewsArticle', 'BlogPosting'], required: [], recommended: ['headline', 'image', 'datePublished', 'dateModified', 'author'], howTo: 'Use the Article page type so headline, image, dates and author are added.' },
  { id: 'breadcrumb', label: 'Breadcrumb', kind: 'markup', schemaTypes: ['BreadcrumbList'], required: ['itemListElement'], howTo: 'Switch breadcrumbs on in the SEO settings.' },
  { id: 'carousel', label: 'Carousel', kind: 'markup', schemaTypes: ['ItemList'], required: ['itemListElement'], howTo: 'Mark up a list of pages of the same kind as an ItemList.' },
  { id: 'course', label: 'Course list', kind: 'markup', schemaTypes: ['Course'], required: ['name', 'description'], recommended: ['provider'], howTo: 'Use the Course page type with a name, description and provider.' },
  { id: 'dataset', label: 'Dataset', kind: 'markup', schemaTypes: ['Dataset'], required: ['name', 'description'], recommended: ['license', 'creator'], howTo: 'Describe the data with a name, description and licence.' },
  { id: 'forum', label: 'Discussion forum', kind: 'markup', schemaTypes: ['DiscussionForumPosting'], required: ['author', 'datePublished'], recommended: ['text', 'headline'], howTo: 'Mark each forum post with its author and date.' },
  { id: 'education-qa', label: 'Education Q&A', kind: 'markup', schemaTypes: ['Quiz'], required: ['about'], howTo: 'Mark flashcard sets as a Quiz.' },
  { id: 'employer-rating', label: 'Employer aggregate rating', kind: 'markup', schemaTypes: ['EmployerAggregateRating'], required: ['ratingValue', 'itemReviewed'], howTo: 'Add the rating and the employer it is about.' },
  { id: 'event', label: 'Event', kind: 'markup', schemaTypes: ['Event'], required: ['name', 'startDate', 'location'], recommended: ['endDate', 'image', 'offers', 'description'], howTo: 'Use the Event page type with a name, start date and place.' },
  { id: 'image-metadata', label: 'Image metadata', kind: 'markup', schemaTypes: ['ImageObject'], required: ['contentUrl'], recommended: ['creator', 'license'], howTo: 'Add creator and licence details to key images.' },
  { id: 'job', label: 'Job posting', kind: 'markup', schemaTypes: ['JobPosting'], required: ['title', 'description', 'datePosted', 'hiringOrganization'], recommended: ['validThrough', 'jobLocation', 'baseSalary'], howTo: 'Use the Job posting page type.' },
  { id: 'local-business', label: 'Local business', kind: 'markup', schemaTypes: ['LocalBusiness', 'Restaurant', 'Store'], required: ['name', 'address'], recommended: ['telephone', 'openingHoursSpecification', 'geo'], howTo: 'Fill in the business group in Site details.' },
  { id: 'math-solver', label: 'Math solver', kind: 'markup', schemaTypes: ['MathSolver'], required: ['url'], howTo: 'Mark a maths solving tool as a MathSolver.' },
  { id: 'movie', label: 'Movie', kind: 'markup', schemaTypes: ['Movie'], required: ['name'], recommended: ['image', 'dateCreated', 'director'], howTo: 'Mark a film page as a Movie.' },
  { id: 'organization', label: 'Organization', kind: 'markup', schemaTypes: ['Organization', 'Corporation', 'NGO'], required: [], recommended: ['name', 'url', 'logo', 'sameAs'], howTo: 'Fill in the organisation in Site details.' },
  { id: 'product', label: 'Product', kind: 'markup', schemaTypes: ['Product'], required: ['name'], recommended: ['image', 'description', 'offers', 'aggregateRating', 'review', 'sku'], howTo: 'Product pages add this on their own; check price and stock are filled in.' },
  { id: 'profile', label: 'Profile page', kind: 'markup', schemaTypes: ['ProfilePage'], required: ['mainEntity'], recommended: ['dateCreated'], howTo: 'Mark author and member pages as a ProfilePage.' },
  { id: 'qa', label: 'Q&A', kind: 'markup', schemaTypes: ['QAPage'], required: ['mainEntity'], howTo: 'Mark a page with one question and its answers as a QAPage.' },
  { id: 'recipe', label: 'Recipe', kind: 'markup', schemaTypes: ['Recipe'], required: ['name', 'image'], recommended: ['recipeIngredient', 'recipeInstructions', 'author', 'aggregateRating'], howTo: 'Use the Recipe page type.' },
  { id: 'review', label: 'Review snippet', kind: 'markup', schemaTypes: ['Review', 'AggregateRating'], required: ['itemReviewed'], recommended: ['author', 'reviewRating'], howTo: 'Show approved reviews on the page so ratings are added.' },
  { id: 'software', label: 'Software app', kind: 'markup', schemaTypes: ['SoftwareApplication', 'MobileApplication', 'WebApplication'], required: ['name', 'offers'], recommended: ['aggregateRating', 'operatingSystem'], howTo: 'Mark an app page as a SoftwareApplication with a price and rating.' },
  { id: 'speakable', label: 'Speakable', kind: 'markup', schemaTypes: ['SpeakableSpecification'], required: [], recommended: ['cssSelector'], howTo: 'Mark the sections a voice assistant should read.' },
  { id: 'paywall', label: 'Subscription and paywalled content', kind: 'markup', schemaTypes: ['WebPage'], required: ['isAccessibleForFree'], howTo: 'Mark members-only pages with isAccessibleForFree set to false.' },
  { id: 'vacation-rental', label: 'Vacation rental', kind: 'markup', schemaTypes: ['VacationRental'], required: ['name', 'address'], recommended: ['image', 'offers'], howTo: 'Mark a rental page as a VacationRental.' },
]

export const SNIPPET_BY_ID: Readonly<Record<string, SnippetType>> = Object.fromEntries(SNIPPET_TYPES.map((t) => [t.id, t]))

export type SnippetState = 'valid' | 'warnings' | 'errors' | 'missing'

export type SnippetDetection = {
  id: string
  state: SnippetState
  /** Required properties that are missing (errors) and recommended ones that are missing (warnings). */
  missingRequired: string[]
  missingRecommended: string[]
}

/** Every node of every JSON-LD block, flattened through @graph. */
function nodesOf(blocks: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const visit = (node: unknown, depth: number): void => {
    if (!node || typeof node !== 'object' || depth > 5) return
    if (Array.isArray(node)) return void node.forEach((n) => visit(n, depth + 1))
    const record = node as Record<string, unknown>
    out.push(record)
    if (Array.isArray(record['@graph'])) visit(record['@graph'], depth + 1)
    for (const key of ['mainEntity', 'itemReviewed', 'hasPart']) visit(record[key], depth + 1)
  }
  blocks.forEach((b) => visit(b, 0))
  return out
}

const typesOf = (node: Record<string, unknown>): string[] => {
  const t = node['@type']
  return typeof t === 'string' ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : []
}

const present = (value: unknown): boolean => value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '') && !(Array.isArray(value) && value.length === 0)

/** Judges one markup type against the JSON-LD on the page. Pure. */
export function detectMarkupType(type: SnippetType, blocks: unknown[]): SnippetDetection {
  const wanted = new Set(type.schemaTypes ?? [])
  const nodes = nodesOf(blocks).filter((n) => typesOf(n).some((t) => wanted.has(t)))
  if (nodes.length === 0) return { id: type.id, state: 'missing', missingRequired: [], missingRecommended: [] }
  // The best matching node decides, so one good block is enough.
  let best: SnippetDetection | null = null
  for (const node of nodes) {
    const missingRequired = (type.required ?? []).filter((p) => !present(node[p]))
    const missingRecommended = (type.recommended ?? []).filter((p) => !present(node[p]))
    const state: SnippetState = missingRequired.length > 0 ? 'errors' : missingRecommended.length > 0 ? 'warnings' : 'valid'
    const rank = { valid: 0, warnings: 1, errors: 2, missing: 3 }
    if (!best || rank[state] < rank[best.state]) best = { id: type.id, state, missingRequired, missingRecommended }
  }
  return best as SnippetDetection
}

/** What the page already has for every catalogue type (content types from the content, markup types from JSON-LD). */
export function detectSnippetTypes(facts: Pick<HtmlFacts, 'jsonLd' | 'questionAnswer' | 'lists' | 'tables' | 'tablesWithHeaders'>): SnippetDetection[] {
  return SNIPPET_TYPES.map((type): SnippetDetection => {
    if (type.id === 'paragraph') return { id: type.id, state: facts.questionAnswer ? 'valid' : 'missing', missingRequired: [], missingRecommended: [] }
    if (type.id === 'list') return { id: type.id, state: facts.lists > 0 ? 'valid' : 'missing', missingRequired: [], missingRecommended: [] }
    if (type.id === 'table') {
      const state: SnippetState = facts.tables === 0 ? 'missing' : facts.tablesWithHeaders === facts.tables ? 'valid' : 'warnings'
      return { id: type.id, state, missingRequired: [], missingRecommended: state === 'warnings' ? ['header cells (th)'] : [] }
    }
    return detectMarkupType(type, facts.jsonLd)
  })
}

/** Likely types for a page, from its collection and template, so the author starts with a sensible list. */
export function suggestSnippetTypes(collection: string, hasVideo: boolean): string[] {
  const base: Record<string, string[]> = {
    posts: ['article', 'breadcrumb', 'paragraph', 'list'],
    products: ['product', 'review', 'breadcrumb', 'table'],
    events: ['event', 'breadcrumb'],
    pages: ['breadcrumb', 'paragraph', 'list'],
  }
  const out = [...(base[collection] ?? base.pages)]
  if (hasVideo) out.push('video')
  return out
}

export const isSnippetId = (value: unknown): value is string => typeof value === 'string' && value in SNIPPET_BY_ID

/** The link to Google's own test for a public address. */
export const richResultsTestUrl = (pageUrl: string): string => `https://search.google.com/test/rich-results?url=${encodeURIComponent(pageUrl)}`

/** What the panel shows: ticked types and types the page already has, with the rest left to the "Add a type" menu. */
export function panelRows(detections: SnippetDetection[], targets: string[]): { shown: SnippetDetection[]; menu: string[] } {
  const want = new Set(targets)
  const shown = detections.filter((d) => want.has(d.id) || d.state !== 'missing')
  const menu = detections.filter((d) => !want.has(d.id) && d.state === 'missing').map((d) => d.id)
  return { shown, menu }
}
