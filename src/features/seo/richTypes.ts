/**
 * Task 21g: richer structured data. A page or post can pick Recipe, JobPosting,
 * HowTo, SoftwareApplication, Review, Person or LocalBusiness and fill in the
 * facts as JSON in "schemaFacts". The node is emitted as the page's mainEntity.
 */

export type RichType = 'Recipe' | 'JobPosting' | 'HowTo' | 'SoftwareApplication' | 'Review' | 'Person' | 'LocalBusiness' | 'Event'

export const RICH_TYPES: RichType[] = ['Recipe', 'JobPosting', 'HowTo', 'SoftwareApplication', 'Review', 'Person', 'LocalBusiness', 'Event']

export const isRichType = (v: unknown): v is RichType => typeof v === 'string' && (RICH_TYPES as string[]).includes(v)

export type Facts = Record<string, unknown>
export type RichContext = { title: string; url: string; imageUrl?: string; siteName?: string; description?: string }

/** Google's required (must) and recommended (should) properties per type. */
export const RICH_REQUIREMENTS: Record<RichType, { must: string[]; should: string[] }> = {
  Recipe: { must: ['image', 'name'], should: ['ingredients', 'steps', 'prepTime', 'cookTime', 'yield', 'ratingValue'] },
  JobPosting: { must: ['title', 'description', 'datePosted', 'company', 'location'], should: ['validThrough', 'employmentType', 'salaryMin'] },
  HowTo: { must: ['name', 'steps'], should: ['totalTime', 'image'] },
  SoftwareApplication: { must: ['name', 'ratingValue', 'price'], should: ['category', 'operatingSystem', 'ratingCount'] },
  Review: { must: ['itemName', 'ratingValue', 'author'], should: ['itemType', 'bestRating'] },
  Person: { must: ['name'], should: ['jobTitle', 'sameAs', 'image'] },
  LocalBusiness: { must: ['name', 'address'], should: ['telephone', 'openingHours', 'image', 'priceRange'] },
  Event: { must: ['name', 'startDate', 'location'], should: ['endDate', 'image', 'price', 'eventStatus'] },
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number(str(v))
  return str(v) !== '' && Number.isFinite(n) ? n : undefined
}
const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : str(v).split('\n')).map((x) => str(x)).filter(Boolean)

/** Reads the stored JSON text. Anything that is not a JSON object gives empty facts. */
export const parseFacts = (raw: unknown): Facts => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Facts
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Facts) : {}
  } catch {
    return {}
  }
}

const present = (v: unknown): boolean => (Array.isArray(v) ? list(v).length > 0 : str(v) !== '')

/** Names of missing required and recommended facts. */
export const validateRich = (type: RichType, facts: Facts): { missing: string[]; recommended: string[] } => {
  const req = RICH_REQUIREMENTS[type]
  return { missing: req.must.filter((k) => !present(facts[k])), recommended: req.should.filter((k) => !present(facts[k])) }
}

/** Message for the edit screen when the JSON text is not valid. Empty text is fine. */
export const factsError = (raw: unknown): string | true => {
  if (typeof raw !== 'string' || !raw.trim()) return true
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? true : 'Facts must be a JSON object, like {"name": "..."}'
  } catch {
    return 'Facts are not valid JSON'
  }
}

const rating = (f: Facts) => {
  const value = num(f.ratingValue)
  if (value === undefined) return undefined
  const count = num(f.ratingCount)
  return { '@type': 'AggregateRating', ratingValue: value, ...(count ? { ratingCount: count } : { ratingCount: 1 }) }
}

const clean = (o: Record<string, unknown>): Record<string, unknown> => {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '' || (Array.isArray(o[k]) && (o[k] as unknown[]).length === 0)) delete o[k]
  return o
}

const steps = (f: Facts, kind: 'HowToStep') => list(f.steps).map((text, i) => ({ '@type': kind, position: i + 1, text }))

/** Builds the schema.org node. Properties without data are left out. */
export const buildRichNode = (type: RichType, f: Facts, ctx: RichContext): Record<string, unknown> => {
  const image = str(f.image) || ctx.imageUrl
  switch (type) {
    case 'Recipe':
      return clean({
        '@type': 'Recipe', name: str(f.name) || ctx.title, image, description: ctx.description,
        recipeIngredient: list(f.ingredients), recipeInstructions: steps(f, 'HowToStep'),
        prepTime: str(f.prepTime), cookTime: str(f.cookTime), recipeYield: str(f.yield), aggregateRating: rating(f),
      })
    case 'HowTo':
      return clean({ '@type': 'HowTo', name: str(f.name) || ctx.title, image, totalTime: str(f.totalTime), step: steps(f, 'HowToStep') })
    case 'JobPosting':
      return clean({
        '@type': 'JobPosting', title: str(f.title) || ctx.title, description: str(f.description), datePosted: str(f.datePosted),
        validThrough: str(f.validThrough), employmentType: str(f.employmentType),
        hiringOrganization: str(f.company) ? { '@type': 'Organization', name: str(f.company) } : undefined,
        jobLocation: str(f.location) ? { '@type': 'Place', address: str(f.location) } : undefined,
        baseSalary: num(f.salaryMin) !== undefined
          ? { '@type': 'MonetaryAmount', currency: str(f.currency) || 'USD', value: clean({ '@type': 'QuantitativeValue', minValue: num(f.salaryMin), maxValue: num(f.salaryMax), unitText: str(f.salaryUnit) || 'YEAR' }) }
          : undefined,
      })
    case 'SoftwareApplication':
      return clean({
        '@type': 'SoftwareApplication', name: str(f.name) || ctx.title, applicationCategory: str(f.category), operatingSystem: str(f.operatingSystem),
        offers: num(f.price) !== undefined ? { '@type': 'Offer', price: num(f.price), priceCurrency: str(f.currency) || 'USD' } : undefined,
        aggregateRating: rating(f),
      })
    case 'Review':
      return clean({
        '@type': 'Review', name: ctx.title,
        itemReviewed: str(f.itemName) ? { '@type': str(f.itemType) || 'Thing', name: str(f.itemName) } : undefined,
        reviewRating: num(f.ratingValue) !== undefined ? clean({ '@type': 'Rating', ratingValue: num(f.ratingValue), bestRating: num(f.bestRating) ?? 5 }) : undefined,
        author: str(f.author) ? { '@type': 'Person', name: str(f.author) } : undefined,
      })
    case 'Person':
      return clean({ '@type': 'Person', name: str(f.name) || ctx.title, jobTitle: str(f.jobTitle), image, url: ctx.url, sameAs: list(f.sameAs) })
    case 'LocalBusiness':
      return clean({
        '@type': 'LocalBusiness', name: str(f.name) || ctx.siteName || ctx.title, image, url: ctx.url, telephone: str(f.telephone), priceRange: str(f.priceRange),
        address: str(f.address) ? { '@type': 'PostalAddress', streetAddress: str(f.address) } : undefined, openingHours: list(f.openingHours),
      })
    case 'Event':
      return clean({
        '@type': 'Event', name: str(f.name) || ctx.title, description: ctx.description, image: image ? [image] : undefined,
        startDate: str(f.startDate), endDate: str(f.endDate),
        eventStatus: str(f.eventStatus) ? `https://schema.org/${str(f.eventStatus)}` : undefined,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: str(f.location) ? { '@type': 'Place', name: str(f.location), address: str(f.address) || str(f.location) } : undefined,
        offers: num(f.price) !== undefined ? { '@type': 'Offer', price: num(f.price), priceCurrency: str(f.currency) || 'USD', url: ctx.url } : undefined,
        organizer: str(f.organizer) ? { '@type': 'Organization', name: str(f.organizer) } : undefined,
      })
  }
}

export type FactInput = 'text' | 'number' | 'date' | 'lines'
export type FactDef = { key: string; label: string; input: FactInput; hint?: string }

/** Form fields per rich type for the facts editor. Keys match RICH_REQUIREMENTS and buildRichNode. */
export const FACT_FIELDS: Record<RichType, FactDef[]> = {
  Recipe: [
    { key: 'name', label: 'Name', input: 'text' }, { key: 'image', label: 'Image address', input: 'text' },
    { key: 'ingredients', label: 'Ingredients', input: 'lines', hint: 'One per line' }, { key: 'steps', label: 'Steps', input: 'lines', hint: 'One per line' },
    { key: 'prepTime', label: 'Prep time', input: 'text', hint: 'For example PT10M' }, { key: 'cookTime', label: 'Cook time', input: 'text', hint: 'For example PT30M' },
    { key: 'yield', label: 'Yield', input: 'text' }, { key: 'ratingValue', label: 'Rating', input: 'number' }, { key: 'ratingCount', label: 'Rating count', input: 'number' },
  ],
  JobPosting: [
    { key: 'title', label: 'Job title', input: 'text' }, { key: 'description', label: 'Description', input: 'text' }, { key: 'datePosted', label: 'Date posted', input: 'date' },
    { key: 'validThrough', label: 'Valid through', input: 'date' }, { key: 'company', label: 'Company', input: 'text' }, { key: 'location', label: 'Location', input: 'text' },
    { key: 'employmentType', label: 'Employment type', input: 'text', hint: 'For example FULL_TIME' }, { key: 'salaryMin', label: 'Salary from', input: 'number' },
    { key: 'salaryMax', label: 'Salary to', input: 'number' }, { key: 'currency', label: 'Currency', input: 'text' }, { key: 'salaryUnit', label: 'Salary unit', input: 'text', hint: 'YEAR, MONTH, HOUR' },
  ],
  HowTo: [
    { key: 'name', label: 'Name', input: 'text' }, { key: 'steps', label: 'Steps', input: 'lines', hint: 'One per line' },
    { key: 'totalTime', label: 'Total time', input: 'text', hint: 'For example PT20M' }, { key: 'image', label: 'Image address', input: 'text' },
  ],
  SoftwareApplication: [
    { key: 'name', label: 'Name', input: 'text' }, { key: 'category', label: 'Category', input: 'text' }, { key: 'operatingSystem', label: 'Operating system', input: 'text' },
    { key: 'price', label: 'Price', input: 'number' }, { key: 'currency', label: 'Currency', input: 'text' }, { key: 'ratingValue', label: 'Rating', input: 'number' }, { key: 'ratingCount', label: 'Rating count', input: 'number' },
  ],
  Review: [
    { key: 'itemName', label: 'Item reviewed', input: 'text' }, { key: 'itemType', label: 'Item type', input: 'text', hint: 'For example Book, Product' },
    { key: 'ratingValue', label: 'Rating', input: 'number' }, { key: 'bestRating', label: 'Best rating', input: 'number' }, { key: 'author', label: 'Author', input: 'text' },
  ],
  Person: [
    { key: 'name', label: 'Name', input: 'text' }, { key: 'jobTitle', label: 'Job title', input: 'text' }, { key: 'image', label: 'Image address', input: 'text' },
    { key: 'sameAs', label: 'Profiles', input: 'lines', hint: 'One address per line' },
  ],
  LocalBusiness: [
    { key: 'name', label: 'Name', input: 'text' }, { key: 'address', label: 'Address', input: 'text' }, { key: 'telephone', label: 'Telephone', input: 'text' },
    { key: 'openingHours', label: 'Opening hours', input: 'lines', hint: 'One per line, like Mo-Fr 09:00-17:00' }, { key: 'image', label: 'Image address', input: 'text' }, { key: 'priceRange', label: 'Price range', input: 'text' },
  ],
  Event: [
    { key: 'name', label: 'Name', input: 'text' }, { key: 'startDate', label: 'Starts', input: 'date' }, { key: 'endDate', label: 'Ends', input: 'date' },
    { key: 'location', label: 'Venue', input: 'text' }, { key: 'address', label: 'Venue address', input: 'text' }, { key: 'image', label: 'Image address', input: 'text' },
    { key: 'price', label: 'Ticket price', input: 'number' }, { key: 'currency', label: 'Currency', input: 'text' }, { key: 'organizer', label: 'Organizer', input: 'text' },
    { key: 'eventStatus', label: 'Status', input: 'text', hint: 'EventScheduled, EventCancelled, EventPostponed or EventMovedOnline' },
  ],
}
