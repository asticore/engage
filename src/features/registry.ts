/**
 * The single source of truth for every optional feature in the portal.
 *
 * One entry per feature describes: what it is called, which collections and
 * globals belong to it, and which database tables it owns. Everything else in
 * the system reads from here rather than hard-coding feature names:
 *
 *   - Site Settings renders one toggle per entry (see featureToggleField).
 *   - The admin sidebar hides a feature's collections/globals when it is off.
 *   - The storefront routes 404 when their feature is off.
 *   - The database cleanup tool uses `tables` to purge a disabled feature's
 *     data on request.
 *
 * Adding a feature means adding one entry here and nothing else structural.
 *
 * `tables` deliberately lists the BASE table names only. The cleanup tool
 * expands each into its real family at runtime - the CMS engine's SQLite adapter also
 * generates `<table>_rels`, `_<table>_v`, `<table>_locales` and one
 * `<table>_blocks_<block>` child per block type - because that expansion
 * changes as blocks are added and would rot if it were written out by hand.
 */

export type FeatureKey =
  | 'ecommerce'
  | 'events'
  | 'blog'
  | 'faq'
  | 'forms'
  | 'seo'
  | 'speed'
  | 'media'
  | 'email'
  | 'backups'
  | 'members'
  | 'abTesting'
  | 'security'
  | 'multilingual'
  | 'accounts'
  | 'lms'
  | 'approval'
  | 'ads'
  | 'tracking'
  | 'taskboard'
  | 'bookings'
  | 'quotes'
  | 'limits'
  | 'mediatags'
  | 'siteplanner'
  | 'affiliates'
  | 'comments'
  | 'dam'
  | 'chatbot'
  | 'agents'
  | 'demos'
  | 'clientreports'
  | 'franchising'
  | 'sso'

export type FeatureDef = {
  key: FeatureKey
  label: string
  /** Shown under the toggle in Site Settings. */
  description: string
  /** Default state for a brand-new install. */
  defaultEnabled: boolean
  /** Collections hidden from the sidebar while this feature is off. */
  collections: string[]
  /** Globals hidden from the sidebar while this feature is off. */
  globals: string[]
  /** Base tables owned by this feature, for the database cleanup tool. */
  tables: string[]
  /**
   * True when the feature is wired end-to-end. False means the settings screen
   * exists and saves, but the behaviour behind it is still being built - the
   * toggle says so plainly rather than pretending to do something.
   */
  implemented: boolean
}

export const FEATURES: FeatureDef[] = [
  {
    key: 'ecommerce',
    label: 'Shop',
    description: 'Products, cart, checkout and orders.',
    defaultEnabled: false,
    collections: ['products', 'product-attributes', 'product-tags', 'product-brands', 'shipping-classes', 'product-reviews', 'stock-subscriptions', 'product-subscriptions', 'gift-cards', 'store-credits', 'credit-ledger', 'shipping-manifests', 'orders', 'order-refunds', 'coupons', 'shipping-zones', 'tax-rates', 'transactions', 'carts', 'addresses'],
    globals: ['shop-settings', 'shop-extra-settings', 'shipping-settings'],
    tables: ['products', 'product_attributes', 'product_tags', 'product_brands', 'shop_display_currencies', 'shop_price_tiers', 'coupon_reservations', 'shipping_classes', 'product_reviews', 'stock_subscriptions', 'product_subscriptions', 'gift_cards', 'store_credits', 'credit_ledger', 'shipping_manifests', 'orders', 'order_refunds', 'coupons', 'shipping_zones', 'tax_rates', 'transactions', 'carts', 'addresses', 'product_feeds'],
    implemented: true,
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Events calendar and RSVPs.',
    defaultEnabled: false,
    collections: ['events', 'event-rsvps'],
    globals: [],
    tables: ['events', 'event_rsvps'],
    implemented: true,
  },
  {
    key: 'blog',
    label: 'Blog',
    description: 'Posts and the blog archive page.',
    defaultEnabled: false,
    collections: ['posts'],
    globals: ['blog-settings'],
    tables: ['posts'],
    implemented: true,
  },
  {
    key: 'faq',
    label: 'FAQs',
    description: 'Standalone FAQ / knowledge base page.',
    defaultEnabled: false,
    collections: ['faqs'],
    globals: ['faq-settings'],
    tables: ['faqs'],
    implemented: true,
  },
  {
    key: 'forms',
    label: 'Forms',
    description: 'Build forms and embed them as blocks. Supports submissions, calculations and payments.',
    defaultEnabled: false,
    collections: ['forms', 'form-submissions', 'form-drafts'],
    globals: [],
    tables: ['forms', 'form_submissions', 'form_drafts', 'form_embeds'],
    implemented: true,
  },
  {
    key: 'seo',
    label: 'SEO & Analytics',
    description: 'Site-wide and per-page SEO, plus analytics and tag manager embedding.',
    defaultEnabled: false,
    collections: ['redirects'],
    globals: ['seo-settings'],
    tables: ['redirects'],
    implemented: true,
  },
  {
    key: 'speed',
    label: 'Speed',
    description: 'Caching, asset optimisation and script-loading controls.',
    defaultEnabled: false,
    collections: [],
    globals: ['speed-settings'],
    tables: [],
    implemented: true,
  },
  {
    key: 'media',
    label: 'Media optimisation',
    description: 'Image compression, resizing and modern formats via Cloudflare.',
    defaultEnabled: false,
    collections: [],
    globals: ['media-settings'],
    tables: [],
    implemented: true,
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Choose the provider used to send transactional email.',
    defaultEnabled: false,
    collections: [],
    globals: ['email-settings', 'email-templates', 'email-brand', 'email-schedule'],
    tables: [],
    implemented: true,
  },
  {
    key: 'backups',
    label: 'Backups',
    description: 'Scheduled or manual backups to an external destination.',
    defaultEnabled: false,
    collections: ['backups'],
    globals: ['backup-settings'],
    tables: ['backups'],
    implemented: true,
  },
  {
    key: 'members',
    label: 'Members',
    description: 'Membership tiers, gated content and subscriptions.',
    defaultEnabled: false,
    collections: ['membership-tiers', 'memberships'],
    globals: ['member-settings'],
    tables: ['membership_tiers', 'memberships'],
    implemented: true,
  },
  {
    key: 'abTesting',
    label: 'A/B testing',
    description: 'Test variants of a template or block and track which performs better.',
    defaultEnabled: false,
    collections: ['ab-tests'],
    globals: [],
    tables: ['ab_tests', 'ab_events', 'ab_stats'],
    implemented: true,
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Login protection, headers, rate limiting and an audit log.',
    defaultEnabled: false,
    collections: ['membership-tiers', 'memberships'],
    globals: ['security-settings'],
    tables: [],
    implemented: true,
  },
  {
    key: 'multilingual',
    label: 'Multilingual',
    description: 'Translate content into additional languages.',
    defaultEnabled: false,
    collections: ['translations'],
    globals: ['language-settings'],
    tables: ['translations'],
    implemented: true,
  },
  {
    key: 'accounts',
    label: 'Customer accounts',
    description: 'Let visitors register and manage their own account.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: [],
    implemented: true,
  },
  {
    key: 'lms',
    label: 'Courses',
    description: 'Course content and student progress.',
    defaultEnabled: false,
    collections: ['courses', 'lessons', 'enrolments', 'lesson-progress'],
    globals: [],
    tables: ['courses', 'lessons', 'enrolments', 'lesson_progress'],
    implemented: true,
  },
  {
    key: 'approval',
    label: 'Content approval',
    description: 'Require a second person to approve pages, posts, events, courses and products before they publish. The rules themselves are set under Settings > Security.',
    defaultEnabled: false,
    collections: ['review-events', 'approval-workflows'],
    globals: [],
    tables: ['review_events', 'approval_workflows'],
    implemented: true,
  },
  {
    key: 'ads',
    label: 'Ads',
    description: 'Show ads from Google AdSense, Google Ad Manager and Prebid header bidding. Loads only after a visitor accepts marketing cookies.',
    defaultEnabled: false,
    collections: ['ad-units', 'ad-placements'],
    globals: ['ad-settings'],
    tables: ['ad_units', 'ad_placements', 'ad_stats'],
    implemented: true,
  },
  {
    key: 'tracking',
    label: 'Tracking events',
    description: 'Fire events (clicks, form submits, page views, scroll depth, time on page) to the Meta, Google, TikTok and custom tag platforms set under Integrations. Nothing fires until the visitor accepts the matching cookie category.',
    defaultEnabled: true,
    collections: ['tracking-events'],
    globals: [],
    tables: ['tracking_events'],
    implemented: true,
  },
  {
    key: 'taskboard',
    label: 'Taskboard',
    description: 'A Kanban board where people create tasks and assign them to admin and staff users.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['task_boards', 'task_columns', 'task_cards', 'task_comments', 'task_activity'],
    implemented: true,
  },
  {
    key: 'bookings',
    label: 'Bookings',
    description: 'Appointment booking pages: people pick a time from your weekly hours and get a confirmation with a link to cancel.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['booking_resources', 'booking_types', 'booking_hours', 'booking_overrides', 'bookings'],
    implemented: true,
  },
  {
    key: 'quotes',
    label: 'Quotes and requests',
    description: 'Customers ask for a quote, make an offer or request an item; you reply with a priced quote they can accept and pay.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['quote_requests'],
    implemented: true,
  },
  {
    key: 'limits',
    label: 'Purchase limits',
    description: 'Per-person limits on limited products and event tickets, a wait between orders, an optional verified-account rule, and a report of refused attempts.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['purchase_limit_rules', 'purchase_limit_blocks'],
    implemented: true,
  },
  {
    key: 'mediatags',
    label: 'Media tags',
    description: 'A tree of tags with colours for media files: tag many files at once, filter by a tag and its sub-tags, and import or export tags as CSV.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['media_tags', 'media_tag_links'],
    implemented: true,
  },
  {
    key: 'dam',
    label: 'Asset manager',
    description: 'Turns Media into a digital asset manager: collections, custom metadata and camera data, full search, versions and safe delete, licence and expiry with approval, private files and share links.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['media_assets', 'media_folders', 'media_collections', 'media_collection_items', 'media_meta_fields', 'media_versions', 'media_shares', 'media_activity', 'media_saved_searches', 'media_renditions', 'media_dam_settings'],
    implemented: true,
  },
  {
    key: 'siteplanner',
    label: 'Site planner',
    description: 'Plan a whole site: describe the idea, answer a few questions, get a page tree with a brief for each page, edit it, then create draft pages and track each page from idea to done. Uses the Claude or OpenAI key from Integrations.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['site_plans'],
    implemented: true,
  },
  {
    key: 'affiliates',
    label: 'Affiliates',
    description: 'Let partners promote the site with their own link (?ref=code). Visits are tracked with a cookie. A commission is worked out on each attributed paid order, waits a set number of days, is reduced by refunds, and is paid out by hand.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['affiliates', 'affiliate_visits', 'affiliate_settings', 'affiliate_commissions', 'affiliate_payouts'],
    implemented: true,
  },
  {
    key: 'comments',
    label: 'Comments',
    description: 'Let visitors comment on blog posts. Comments wait for approval by default, can be threaded, and close after a set number of days. Moderate them in the admin.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['comments', 'comment_settings'],
    implemented: true,
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    description: 'A chat assistant that answers visitors from the FAQ first, then pages, posts and products, with a link to each source. It hands off to the contact page when unsure. Uses the Claude or OpenAI key from Integrations and the shared monthly AI spend cap, or answers from the FAQ alone when no key is set.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['chatbot_settings', 'chatbot_conversations', 'chatbot_messages'],
    implemented: true,
  },
  {
    key: 'agents',
    label: 'AI agent access',
    description: 'Give a connected AI tool its own scoped, revocable token for the admin API, with a daily cap on writes and reads and a log of everything it did. Off by default.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['agent_grants', 'agent_actions'],
    implemented: true,
  },
  {
    key: 'demos',
    label: 'Agency demos',
    description: 'Run this site as a demo for clients. Save a copy of the demo, reset it back to that copy by hand or on a schedule, create view-only demo accounts, and download the copy as a package to import on a client site later.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['demo_settings', 'demo_snapshots'],
    implemented: true,
  },
  {
    key: 'clientreports',
    label: 'Client reports',
    description: 'Make read-only report links for a client (sales, form entries and content over a date range), download the numbers as CSV and email the report on a weekly or monthly schedule.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['client_reports'],
    implemented: true,
  },
  {
    key: 'franchising',
    label: 'Franchising',
    description: 'Give each franchise its own domain, owner and pages. Roll a shared page template out to every franchise as locked pages, and roll later updates out again.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['franchises', 'franchise_pages'],
    implemented: true,
  },
  {
    key: 'sso',
    label: 'Single sign-on',
    description: 'Let an organisation sign its people in with its own OpenID Connect identity provider. Each email domain is proved with a DNS record, new members can be created on first sign-in, and single sign-on can be required so those addresses no longer use a password. Off by default.',
    defaultEnabled: false,
    collections: [],
    globals: [],
    tables: ['org_sso', 'org_sso_links'],
    implemented: true,
  },
]

export const FEATURE_MAP: Record<FeatureKey, FeatureDef> = Object.fromEntries(
  FEATURES.map((feature) => [feature.key, feature]),
) as Record<FeatureKey, FeatureDef>

export type FeatureFlags = Record<FeatureKey, boolean>

export const DEFAULT_FLAGS: FeatureFlags = Object.fromEntries(
  FEATURES.map((feature) => [feature.key, feature.defaultEnabled]),
) as FeatureFlags

/** Collections that only exist while their owning feature is enabled. */
export function collectionsForFeature(key: FeatureKey): string[] {
  return FEATURE_MAP[key]?.collections ?? []
}

/**
 * Reverse index: which feature owns a given collection/global slug.
 * Anything not owned by a feature is always visible.
 */
export const OWNER_OF_COLLECTION: Record<string, FeatureKey> = {}
export const OWNER_OF_GLOBAL: Record<string, FeatureKey> = {}

for (const feature of FEATURES) {
  for (const slug of feature.collections) OWNER_OF_COLLECTION[slug] = feature.key
  for (const slug of feature.globals) OWNER_OF_GLOBAL[slug] = feature.key
}

/** True when a collection should be visible given the current flags. */
export function isCollectionEnabled(slug: string, flags: FeatureFlags): boolean {
  const owner = OWNER_OF_COLLECTION[slug]
  return owner ? Boolean(flags[owner]) : true
}

/** True when a global should be visible given the current flags. */
export function isGlobalEnabled(slug: string, flags: FeatureFlags): boolean {
  const owner = OWNER_OF_GLOBAL[slug]
  return owner ? Boolean(flags[owner]) : true
}
