/**
 * Fresh-install questionnaire: pure rules that turn the owner's answers about the company
 * into a list of sections (features) to switch on. No React, no I/O.
 *
 * Suggestions only ever turn features ON. A skipped or re-run questionnaire never switches
 * anything off, and `tracking` is left as it is. Bookings have no feature yet: the answer is
 * stored and an enquiry form is suggested in the meantime.
 */
import { DEFAULT_FLAGS, FEATURES, type FeatureFlags, type FeatureKey } from '@/features/registry'

export const BUSINESS_TYPES = [
  'salon_hair',
  'clinic_gp',
  'car_rental',
  'hotel_bnb',
  'retail_shop',
  'restaurant_cafe',
  'services_agency',
  'education_training',
  'nonprofit_community',
  'other',
] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const SITE_SHAPES = ['single', 'franchise', 'regional'] as const
export type SiteShape = (typeof SITE_SHAPES)[number]

export const PRODUCT_KINDS = ['physical', 'digital', 'services', 'none'] as const
export type ProductKind = (typeof PRODUCT_KINDS)[number]

export const BOOKING_KINDS = ['none', 'appointments', 'rentals_daily', 'nightly_stays'] as const
export type BookingKind = (typeof BOOKING_KINDS)[number]

export const LANGUAGE_CHOICES = ['one', 'several'] as const
export type LanguageChoice = (typeof LANGUAGE_CHOICES)[number]

export type SetupAnswers = {
  siteShape?: SiteShape
  products?: ProductKind[]
  bookings?: BookingKind
  events?: boolean
  courses?: boolean
  membership?: boolean
  blog?: boolean
  forms?: boolean
  languages?: LanguageChoice
  /** Locale codes from LOCALE_OPTIONS, only meaningful when `languages` is 'several'. */
  locales?: string[]
  businessType?: BusinessType
}

export type SetupQuestionnaireState = {
  status: 'completed' | 'skipped'
  completedAt: string
  answers?: SetupAnswers
  appliedFeatures?: FeatureKey[]
  reason?: string
}

export type Suggestion = { on: FeatureKey[]; notes: string[] }

export const NOTE_DOMAINS = 'Several domains or regions: set them up in Settings > Domains.'
export const NOTE_BOOKINGS = 'Online bookings are planned; we will let you know when they are ready.'

const BUSINESS_DEFAULTS: Record<BusinessType, FeatureKey[]> = {
  salon_hair: ['forms'],
  clinic_gp: ['forms'],
  car_rental: ['forms'],
  hotel_bnb: ['forms'],
  retail_shop: ['ecommerce', 'accounts', 'email'],
  restaurant_cafe: ['forms'],
  services_agency: [],
  education_training: ['lms'],
  nonprofit_community: ['events', 'forms'],
  other: [],
}

/** Which features the answers suggest switching on, in registry order, plus plain-language notes. */
export function suggestFeatures(answers: SetupAnswers): Suggestion {
  const wanted = new Set<FeatureKey>()
  const notes: string[] = []
  const add = (...keys: FeatureKey[]): void => {
    for (const key of keys) wanted.add(key)
  }

  if (answers.siteShape === 'franchise' || answers.siteShape === 'regional') notes.push(NOTE_DOMAINS)

  const products = answers.products ?? []
  if (products.some((kind) => kind === 'physical' || kind === 'digital' || kind === 'services')) add('ecommerce', 'accounts', 'email')

  if (answers.bookings && answers.bookings !== 'none') {
    add('forms')
    notes.push(NOTE_BOOKINGS)
  }

  if (answers.events) add('events', 'email')
  if (answers.courses) add('lms', 'accounts')
  if (answers.membership) add('members', 'accounts')
  if (answers.blog) add('blog', 'seo')
  if (answers.forms) add('forms', 'email')
  if (answers.languages === 'several') add('multilingual')
  if (answers.businessType) add(...BUSINESS_DEFAULTS[answers.businessType])

  const on = FEATURES.map((feature) => feature.key).filter((key) => wanted.has(key))
  return { on, notes }
}

/** The current flags with the selected features switched on. Nothing is ever switched off. */
export function applySuggestion(currentFlags: Partial<FeatureFlags>, selectedKeys: readonly FeatureKey[]): FeatureFlags {
  const merged: FeatureFlags = { ...DEFAULT_FLAGS, ...currentFlags }
  for (const key of selectedKeys) merged[key] = true
  return merged
}

/** The body of the single save: features plus the questionnaire record. */
export function buildSavePayload(
  mode: 'apply' | 'skip',
  args: { currentFlags: Partial<FeatureFlags>; selected: readonly FeatureKey[]; answers: SetupAnswers; now?: Date },
): { features?: FeatureFlags; setupQuestionnaire: SetupQuestionnaireState } {
  const completedAt = (args.now ?? new Date()).toISOString()
  if (mode === 'skip') return { setupQuestionnaire: { status: 'skipped', completedAt } }
  return {
    features: applySuggestion(args.currentFlags, args.selected),
    setupQuestionnaire: { status: 'completed', completedAt, answers: args.answers, appliedFeatures: [...args.selected] },
  }
}
