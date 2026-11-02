/**
 * Which feature owns which database table.
 *
 * One answer per table: a table is CORE (created on every install and never
 * offered for deletion) or belongs to exactly one feature in `FEATURES`
 * (registry.ts). A feature's tables are created lazily: a fresh install only
 * creates core tables and the tables of features that are on by default; the
 * rest are created the first time the feature is switched on (see
 * `provisioning.ts`). Switching a feature off never removes anything.
 *
 * The map is derived, not copied: `FEATURES[].tables` names each feature's
 * BASE tables and this file expands them into the adapter's families
 * (`<t>_rels`, `<t>_locales`, `<t>_blocks_<block>`, array children, and the
 * version mirror `_<t>_v...`) by name, so a new block or array field is owned
 * the day it appears. Tables are matched with the `eg_` prefix removed, so the
 * pre-rename names the foundation migrations still use (`products`) resolve to
 * the same owner as `eg_products`.
 *
 * Globals (settings pages such as `eg_seo_settings`) are deliberately CORE:
 * they are tiny, and they are read by the layout and the admin on every
 * request, so they are always created. Only collection data is lazy.
 *
 * `tests/int/feature-tables-registry.int.spec.ts` builds the full schema and
 * fails when a table is neither a family of a feature base nor in CORE, or is
 * claimed twice, so adding a table forces a decision here.
 */

import { FEATURES, type FeatureKey } from './registry'

export const CORE_OWNER = 'core' as const
export type TableOwner = FeatureKey | typeof CORE_OWNER

/**
 * Payment records. They are never offered for deletion from the Unused tables
 * screen, even when their feature is off (decision 2 Nov 2026: money records
 * are kept for accounting and tax whatever the settings say). Base names, matched
 * as families like feature tables.
 */
export const PAYMENT_RECORD_BASES = [
  'orders',
  'order_refunds',
  'transactions',
  'credit_ledger',
  'gift_cards',
  'store_credits',
  'product_subscriptions',
  'coupon_reservations',
]

/** The name a table goes by with the `eg_` prefix and version-mirror underscore removed. */
export function normaliseTableName(table: string): string {
  return table.replace(/^_/, '').replace(/^eg_/, '')
}

/** True when `name` (normalised) is `base` or one of its children. */
function inBaseFamily(name: string, base: string): boolean {
  return name === base || name.startsWith(`${base}_`)
}

type ClaimedBase = { base: string; feature: FeatureKey }

/** Every declared base table with its feature, longest base first so the most specific wins. */
const CLAIMS: ClaimedBase[] = FEATURES.flatMap((feature) => feature.tables.map((base) => ({ base, feature: feature.key }))).sort(
  (a, b) => b.base.length - a.base.length,
)

/** Feature bases that are claimed by more than one feature (must stay empty; the registry test checks it). */
export function duplicateBaseClaims(): string[] {
  const seen = new Map<string, FeatureKey>()
  const duplicates: string[] = []
  for (const claim of CLAIMS) {
    const first = seen.get(claim.base)
    if (first && first !== claim.feature) duplicates.push(claim.base)
    seen.set(claim.base, claim.feature)
  }
  return duplicates
}

/** The feature that owns a table, or `core`. Never throws, never reads the database. */
export function ownerOfTable(table: string): TableOwner {
  const name = normaliseTableName(table)
  for (const claim of CLAIMS) {
    if (inBaseFamily(name, claim.base)) return claim.feature
  }
  return CORE_OWNER
}

/**
 * Core tables, named explicitly so that a NEW table has to be classified: the
 * registry test fails for any table that is neither a family of a feature base
 * (registry.ts `tables`) nor listed here. Includes every global's settings
 * table (always created, see the header) and engine bookkeeping.
 */
export const CORE_TABLE_BASES = [
  'ad_settings', 'ai_builder_usage', 'api_builder_settings', 'api_endpoint_log', 'api_endpoints', 'api_keys', 'audit_log',
  'backup_settings', 'blog_settings', 'content_access', 'content_org_visibility', 'content_passwords', 'cron_runs',
  'custom_field_options', 'data_views', 'domain_settings', 'edit_locks', 'email_brand', 'email_log', 'email_schedule',
  'email_settings', 'email_suppressions', 'email_templates', 'email_verifications', 'error_log', 'faq_settings',
  'feature_tables', 'field_groups', 'footer', 'form_settings', 'google_connection', 'header', 'impersonations',
  'integrations', 'kv', 'language_settings', 'locked_documents', 'login_tokens', 'machine_translation_usage', 'media',
  'media_settings', 'member_settings', 'migrations', 'navigation', 'not_found_log', 'number_counters',
  'organization_invitations', 'organization_members', 'organization_roles', 'organization_team_members',
  'organization_teams', 'organizations', 'page_templates', 'pages', 'pagespeed_queue', 'pagespeed_results', 'passkeys',
  'password_groups', 'payment_settings', 'preferences', 'privacy_requests', 'rate_limits', 'reusable_sections', 'roles',
  'scheduled_publishes', 'security_settings', 'seo_settings', 'shipping_settings', 'shop_extra_settings', 'shop_settings',
  'site_details', 'site_pages', 'site_settings', 'site_templates', 'social_accounts', 'speed_settings',
  'template_libraries', 'theme_styles', 'tracking_connections', 'trusted_devices', 'two_factor_email_codes',
  'user_sessions', 'users', 'webhook_deliveries', 'webhook_inbound', 'webhook_inbound_log', 'webhook_settings',
  'webhooks', 'sqlite_sequence', 'cf_METADATA',
]

/** True when a table is explicitly listed as core (a family of a CORE_TABLE_BASES entry). */
export function isCoreTable(table: string): boolean {
  const name = normaliseTableName(table).replace(/^_/, '')
  return CORE_TABLE_BASES.some((base) => inBaseFamily(name, base))
}

/** True when a table holds payment records (kept whatever the feature state). */
export function isPaymentRecordTable(table: string): boolean {
  const name = normaliseTableName(table)
  return PAYMENT_RECORD_BASES.some((base) => inBaseFamily(name, base))
}

/** Features that own tables at all (the others only own settings pages, routes and so on). */
export const FEATURES_WITH_TABLES: FeatureKey[] = FEATURES.filter((feature) => feature.tables.length > 0).map((feature) => feature.key)

/**
 * Features whose tables are NOT created on a fresh install: every feature that
 * owns tables and is off by default. A feature that is on by default
 * (tracking) is provisioned at install.
 */
export const DEFERRED_ON_FRESH_INSTALL: FeatureKey[] = FEATURES.filter(
  (feature) => feature.tables.length > 0 && !feature.defaultEnabled,
).map((feature) => feature.key)
