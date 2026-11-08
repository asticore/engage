// @vitest-environment node
// Fresh-install questionnaire rules: what each answer suggests, and that a suggestion never switches anything off.
import { describe, expect, it } from 'vitest'

import { DEFAULT_FLAGS, FEATURES, type FeatureKey } from '@/features/registry'
import {
  BOOKING_KINDS,
  BUSINESS_TYPES,
  NOTE_BOOKINGS,
  NOTE_DOMAINS,
  PRODUCT_KINDS,
  SITE_SHAPES,
  applySuggestion,
  buildSavePayload,
  suggestFeatures,
} from '@/features/setup/questionnaire'
import { UI_STRING_SOURCE } from '@/features/uiStrings'

const on = (answers: Parameters<typeof suggestFeatures>[0]): FeatureKey[] => suggestFeatures(answers).on

describe('suggestFeatures', () => {
  it('suggests nothing for no answers', () => {
    expect(suggestFeatures({})).toEqual({ on: [], notes: [] })
  })

  it('points franchises and regions to Settings > Domains and enables nothing', () => {
    for (const siteShape of ['franchise', 'regional'] as const) expect(suggestFeatures({ siteShape })).toEqual({ on: [], notes: [NOTE_DOMAINS] })
    expect(suggestFeatures({ siteShape: 'single' })).toEqual({ on: [], notes: [] })
  })

  it('turns the shop on for physical, digital or paid services, and not for none', () => {
    for (const kind of ['physical', 'digital', 'services'] as const) expect(on({ products: [kind] })).toEqual(['ecommerce', 'email', 'accounts'])
    expect(on({ products: ['none'] })).toEqual([])
  })

  it('stores bookings as an answer, enables only an enquiry form and says bookings are planned', () => {
    expect(suggestFeatures({ bookings: 'none' })).toEqual({ on: [], notes: [] })
    for (const bookings of ['appointments', 'rentals_daily', 'nightly_stays'] as const) {
      expect(suggestFeatures({ bookings })).toEqual({ on: ['forms'], notes: [NOTE_BOOKINGS] })
    }
  })

  it('maps events, courses, membership, blog and forms', () => {
    expect(on({ events: true })).toEqual(['events', 'email'])
    expect(on({ courses: true })).toEqual(['accounts', 'lms'])
    expect(on({ membership: true })).toEqual(['members', 'accounts'])
    expect(on({ blog: true })).toEqual(['blog', 'seo'])
    expect(on({ forms: true })).toEqual(['forms', 'email'])
  })

  it('turns multilingual on only for several languages', () => {
    expect(on({ languages: 'one' })).toEqual([])
    expect(on({ languages: 'several', locales: ['fr-FR'] })).toEqual(['multilingual'])
  })

  it('applies the business type defaults', () => {
    const expected: Record<string, FeatureKey[]> = {
      clinic_gp: ['forms'],
      retail_shop: ['ecommerce', 'email', 'accounts'],
      education_training: ['lms'],
      nonprofit_community: ['events', 'forms'],
      restaurant_cafe: ['forms'],
      hotel_bnb: ['forms'],
      car_rental: ['forms'],
      salon_hair: ['forms'],
      services_agency: [],
      other: [],
    }
    for (const type of BUSINESS_TYPES) expect(on({ businessType: type }), type).toEqual(expected[type])
  })

  it('removes duplicates and keeps registry order', () => {
    const result = on({ products: ['physical', 'digital'], events: true, forms: true, courses: true, membership: true, blog: true, languages: 'several', businessType: 'retail_shop' })
    expect(new Set(result).size).toBe(result.length)
    const registryOrder = FEATURES.map((f) => f.key).filter((k) => result.includes(k))
    expect(result).toEqual(registryOrder)
  })

  it('never suggests tracking and every key it returns is a real feature', () => {
    const everything = on({ siteShape: 'regional', products: ['physical'], bookings: 'appointments', events: true, courses: true, membership: true, blog: true, forms: true, languages: 'several', businessType: 'nonprofit_community' })
    expect(everything).not.toContain('tracking')
    for (const key of everything) expect(FEATURES.some((f) => f.key === key)).toBe(true)
  })
})

describe('applySuggestion', () => {
  it('switches the selected features on and never switches anything off', () => {
    const current = { ...DEFAULT_FLAGS, blog: true, tracking: false, ads: true }
    const merged = applySuggestion(current, ['ecommerce', 'events'])
    expect(merged.ecommerce).toBe(true)
    expect(merged.events).toBe(true)
    expect(merged.blog).toBe(true)
    expect(merged.ads).toBe(true)
    expect(merged.tracking).toBe(false)
    for (const feature of FEATURES) if (current[feature.key as FeatureKey]) expect(merged[feature.key]).toBe(true)
  })

  it('fills missing flags from the defaults and keeps the current object untouched', () => {
    const current = { blog: true }
    const merged = applySuggestion(current, [])
    expect(merged).toEqual({ ...DEFAULT_FLAGS, blog: true })
    expect(current).toEqual({ blog: true })
  })
})

describe('buildSavePayload', () => {
  const now = new Date('2027-03-11T00:00:00.000Z')

  it('apply saves the merged features and the answers in one body', () => {
    const answers = { events: true }
    const payload = buildSavePayload('apply', { currentFlags: { ...DEFAULT_FLAGS, blog: true }, selected: ['events', 'email'], answers, now })
    expect(payload.features?.events).toBe(true)
    expect(payload.features?.blog).toBe(true)
    expect(payload.setupQuestionnaire).toEqual({ status: 'completed', completedAt: now.toISOString(), answers, appliedFeatures: ['events', 'email'] })
  })

  it('skip saves only the skipped record and no features', () => {
    const payload = buildSavePayload('skip', { currentFlags: DEFAULT_FLAGS, selected: ['events'], answers: { events: true }, now })
    expect(payload).toEqual({ setupQuestionnaire: { status: 'skipped', completedAt: now.toISOString() } })
  })
})

describe('questionnaire strings', () => {
  it('has an English string for every option and notes the component shows', () => {
    const wanted = [
      ...SITE_SHAPES.map((v) => `shape.${v}`),
      ...PRODUCT_KINDS.map((v) => `products.${v}`),
      ...BOOKING_KINDS.map((v) => `bookings.${v}`),
      ...BUSINESS_TYPES.map((v) => `business.${v}`),
      ...['events', 'courses', 'membership', 'blog', 'forms'].map((v) => `more.${v}`),
      'languages.one',
      'languages.several',
      'note.domains',
      'note.bookings',
    ]
    for (const name of wanted) expect(UI_STRING_SOURCE, name).toHaveProperty(`setup.q.${name}`)
  })

  it('keeps the note text in step with the English strings', () => {
    expect(UI_STRING_SOURCE['setup.q.note.domains']).toBe(NOTE_DOMAINS)
    expect(UI_STRING_SOURCE['setup.q.note.bookings']).toBe(NOTE_BOOKINGS)
  })
})
