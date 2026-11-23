import { sql } from 'drizzle-orm'

import { getDb } from '@/cms/db/connect'

/**
 * Storage for Options pages: site-wide custom field values that belong to no
 * collection (eg business phone, opening hours). One row per options page slug
 * in eg_custom_field_options, values kept as a JSON object.
 *
 * Raw SQL on the shared db handle, like src/cms/db/scheduledPublishes.ts,
 * because this table is not a collection and has no engine config.
 */

export type OptionValues = Record<string, unknown>

/** Options page slugs are short, lowercase and safe to use inside a merge tag. */
export const OPTION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isValidOptionSlug(slug: string): boolean {
  return OPTION_SLUG_PATTERN.test(slug)
}

/**
 * Per-language values live in the same JSON row under this reserved key:
 * `{ ...defaults, __l10n: { fr: { tagline: 'Bonjour' } } }`. Only text values are translated;
 * a language with no entry for a field shows the default value. The key is never a field name
 * (field names are lowercase letters, digits and underscores).
 */
export const L10N_KEY = '__l10n'

export type OptionOverrides = Record<string, Record<string, string>>

/** The stored values without the language overrides: what the default-language form shows. */
export function defaultValuesOf(stored: OptionValues): OptionValues {
  const rest = { ...stored }
  delete rest[L10N_KEY]
  return rest
}

/** The language overrides of a stored row, keeping only non-empty text values. */
export function overridesOf(stored: OptionValues): OptionOverrides {
  const raw = stored[L10N_KEY]
  const out: OptionOverrides = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [locale, fields] of Object.entries(raw as Record<string, unknown>)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue
    const clean: Record<string, string> = {}
    for (const [name, value] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim() !== '') clean[name] = value
    }
    if (Object.keys(clean).length > 0) out[locale] = clean
  }
  return out
}

/** The values to show visitors of one language: the defaults with that language's text laid over them. */
export function valuesForLocale(stored: OptionValues, locale: string | null | undefined): OptionValues {
  const base = defaultValuesOf(stored)
  if (!locale) return base
  const over = overridesOf(stored)[locale]
  return over ? { ...base, ...over } : base
}

function parseValues(raw: unknown): OptionValues {
  if (typeof raw !== 'string' || raw === '') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as OptionValues) : {}
  } catch {
    return {}
  }
}

export async function getOptionValues(slug: string): Promise<{ values: OptionValues; updatedAt: string | null }> {
  const db = await getDb()
  const rows = (await db.all(
    sql`SELECT \`values\`, updated_at FROM \`eg_custom_field_options\` WHERE slug = ${slug}`,
  )) as { values: string; updated_at: string }[]
  if (!rows[0]) return { values: {}, updatedAt: null }
  return { values: parseValues(rows[0].values), updatedAt: rows[0].updated_at }
}

/** Every stored options page, for the merge-tag context. */
export async function getAllOptionValues(): Promise<Record<string, OptionValues>> {
  const db = await getDb()
  const rows = (await db.all(sql`SELECT slug, \`values\` FROM \`eg_custom_field_options\``)) as { slug: string; values: string }[]
  const out: Record<string, OptionValues> = {}
  for (const row of rows) out[row.slug] = parseValues(row.values)
  return out
}

/** Public helper: one option's stored value, or undefined. Safe in server components. */
export async function getOption(slug: string, name: string): Promise<unknown> {
  try {
    const { values } = await getOptionValues(slug)
    return values[name]
  } catch {
    return undefined
  }
}

/**
 * Saves the default-language values of an options page. The language overrides already stored
 * are kept, so saving the default form never wipes a translation.
 */
export async function saveOptionValues(slug: string, values: OptionValues): Promise<string> {
  const db = await getDb()
  const now = new Date().toISOString()
  const existing = await getOptionValues(slug).catch(() => ({ values: {} as OptionValues }))
  const overrides = overridesOf(existing.values)
  const json = JSON.stringify(Object.keys(overrides).length > 0 ? { ...defaultValuesOf(values), [L10N_KEY]: overrides } : defaultValuesOf(values))
  await db.run(
    sql`INSERT INTO \`eg_custom_field_options\` (slug, \`values\`, updated_at) VALUES (${slug}, ${json}, ${now})
        ON CONFLICT(slug) DO UPDATE SET \`values\` = excluded.\`values\`, updated_at = excluded.updated_at`,
  )
  return now
}

/** Saves one language's text overrides for an options page, replacing that language's earlier ones. */
export async function saveOptionLocale(slug: string, locale: string, texts: Record<string, string>): Promise<string> {
  const db = await getDb()
  const now = new Date().toISOString()
  const existing = await getOptionValues(slug)
  const overrides = overridesOf(existing.values)
  const clean = Object.fromEntries(Object.entries(texts).filter(([, v]) => typeof v === 'string' && v.trim() !== ''))
  if (Object.keys(clean).length > 0) overrides[locale] = clean
  else delete overrides[locale]
  const base = defaultValuesOf(existing.values)
  const json = JSON.stringify(Object.keys(overrides).length > 0 ? { ...base, [L10N_KEY]: overrides } : base)
  await db.run(
    sql`INSERT INTO \`eg_custom_field_options\` (slug, \`values\`, updated_at) VALUES (${slug}, ${json}, ${now})
        ON CONFLICT(slug) DO UPDATE SET \`values\` = excluded.\`values\`, updated_at = excluded.updated_at`,
  )
  return now
}
