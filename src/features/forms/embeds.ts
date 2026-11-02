import { resolveD1Binding } from '@/cms/db/d1Binding'

import { cleanOrigin } from './config'

/**
 * External embeds (phase 2): one row per embed of a form, in `eg_form_embeds` (migration 20270306_100000_form_embeds).
 *
 * An embed is a way of showing a form on another website. It has its own public key, which is its address
 * (/embed/<key>) and the key its submissions are sent to; a source name, which its submissions carry; the
 * websites allowed to show or post to it (empty means any website); and a theme. Forms are still built only in
 * the visual editor: an embed never has fields of its own.
 *
 * Theme: three picks, each from the site's own design pickers (Theming > Colours, Typography, Scales). The
 * embed page reads the same theme styles as the rest of the site, so nothing here is a second style system:
 *   - colour: a palette colour id (or none, to use the site accent);
 *   - font: the site's heading or body font;
 *   - radius: the site's small, medium or large corner radius, or none.
 */

export const EMBED_TABLE = '`eg_form_embeds`'
export const EMBED_RADII = ['none', 'small', 'medium', 'large'] as const
export const EMBED_FONTS = ['body', 'heading'] as const
export const MAX_EMBEDS_PER_FORM = 20
export const MAX_EMBED_NAME = 80
export const MAX_EMBED_ORIGINS = 50

export type EmbedRadius = (typeof EMBED_RADII)[number]
export type EmbedFont = (typeof EMBED_FONTS)[number]
export type EmbedTheme = { colour?: string; font?: EmbedFont; radius?: EmbedRadius }

export type EmbedRecord = {
  id: number
  formId: number
  name: string
  embedKey: string
  enabled: boolean
  allowedOrigins: string[]
  theme: EmbedTheme
  createdAt: string
  updatedAt: string
}

const COLOUR_ID = /^[a-z0-9-]{1,32}$/
const EMBED_KEY = /^[A-Za-z0-9_-]{1,60}$/

/** Keys that the site uses for its own pages under /embed, so an embed can never take them. */
export const RESERVED_EMBED_KEYS = new Set(['data', 'forms'])

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

/** Keeps only valid picks. Anything else is dropped, so the field falls back to the site's own design. */
export function cleanEmbedTheme(input: unknown): EmbedTheme {
  const raw = record(input)
  const theme: EmbedTheme = {}
  if (typeof raw.colour === 'string' && COLOUR_ID.test(raw.colour)) theme.colour = raw.colour
  if (typeof raw.font === 'string' && (EMBED_FONTS as readonly string[]).includes(raw.font)) theme.font = raw.font as EmbedFont
  if (typeof raw.radius === 'string' && (EMBED_RADII as readonly string[]).includes(raw.radius)) theme.radius = raw.radius as EmbedRadius
  return theme
}

/** The websites allowed, cleaned and de-duplicated. Anything that is not an origin is dropped. */
export function cleanEmbedOrigins(input: unknown): string[] {
  const origins: string[] = []
  for (const entry of Array.isArray(input) ? input : []) {
    const origin = cleanOrigin(entry)
    if (origin && !origins.includes(origin) && origins.length < MAX_EMBED_ORIGINS) origins.push(origin)
  }
  return origins
}

export function cleanEmbedName(input: unknown, fallback: string): string {
  const name = typeof input === 'string' ? input.trim().slice(0, MAX_EMBED_NAME) : ''
  return name || fallback
}

/** A fresh public key, the same shape as a form's own key. */
export function newEmbedKey(random: (bytes: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let key = ''
  for (const byte of random(14)) key += alphabet[byte % alphabet.length]
  return key
}

export const isEmbedKeyShape = (key: string): boolean => EMBED_KEY.test(key) && !RESERVED_EMBED_KEYS.has(key)

/**
 * The inline custom properties for an embed's form root, from its theme and the site's palette ids.
 * A colour that is no longer in the palette is left out (the site accent is used). Pure.
 */
export function embedThemeStyle(theme: EmbedTheme, siteColourIds: ReadonlySet<string>): Record<string, string> {
  const style: Record<string, string> = {}
  if (theme.colour && siteColourIds.has(theme.colour)) style['--eg-accent'] = `var(--eg-c-${theme.colour})`
  if (theme.radius) {
    const radius: Record<Exclude<EmbedRadius, 'none'>, string> = { small: 'var(--eg-radius-sm)', medium: 'var(--eg-radius-md)', large: 'var(--eg-radius-lg)' }
    style['--eg-radius'] = theme.radius === 'none' ? '0px' : radius[theme.radius]
  }
  if (theme.font) style.fontFamily = theme.font === 'heading' ? 'var(--font-display)' : 'var(--font-body)'
  return style
}

type EmbedRow = {
  id: number
  form_id: number
  name: string
  embed_key: string
  enabled: number | boolean
  allowed_origins: string | null
  theme: string | null
  created_at: string
  updated_at: string
}

function parseJson(text: string | null, fallback: unknown): unknown {
  if (!text) return fallback
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

export function embedFromRow(row: EmbedRow): EmbedRecord {
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    name: String(row.name),
    embedKey: String(row.embed_key),
    enabled: row.enabled === true || row.enabled === 1,
    allowedOrigins: cleanEmbedOrigins(parseJson(row.allowed_origins, [])),
    theme: cleanEmbedTheme(parseJson(row.theme, {})),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

const COLUMNS = 'id, form_id, name, embed_key, enabled, allowed_origins, theme, created_at, updated_at'

/** Every embed, for the admin screen. Ordered by form, then by when it was made. */
export async function listAllEmbeds(): Promise<EmbedRecord[]> {
  const d1 = await resolveD1Binding()
  const { results } = await d1.prepare(`SELECT ${COLUMNS} FROM ${EMBED_TABLE} ORDER BY form_id, id`).all<EmbedRow>()
  return (results ?? []).map(embedFromRow)
}

/** One embed by its public key, or null. Throws when the table cannot be read. */
export async function findEmbedByKey(key: string): Promise<EmbedRecord | null> {
  if (!EMBED_KEY.test(key)) return null
  const d1 = await resolveD1Binding()
  const row = await d1.prepare(`SELECT ${COLUMNS} FROM ${EMBED_TABLE} WHERE embed_key = ? LIMIT 1`).bind(key).first<EmbedRow>()
  return row ? embedFromRow(row) : null
}

/** One embed by its id, or null. */
export async function findEmbedById(id: number): Promise<EmbedRecord | null> {
  const d1 = await resolveD1Binding()
  const row = await d1.prepare(`SELECT ${COLUMNS} FROM ${EMBED_TABLE} WHERE id = ? LIMIT 1`).bind(id).first<EmbedRow>()
  return row ? embedFromRow(row) : null
}

export async function countEmbedsForForm(formId: number): Promise<number> {
  const d1 = await resolveD1Binding()
  const row = await d1.prepare(`SELECT COUNT(*) AS n FROM ${EMBED_TABLE} WHERE form_id = ?`).bind(formId).first<{ n: number }>()
  return Number(row?.n ?? 0)
}

/** True when a key is already used by an embed or by a form's own key, so a new embed never reuses one. */
export async function embedKeyTaken(key: string): Promise<boolean> {
  const d1 = await resolveD1Binding()
  const embed = await d1.prepare(`SELECT id FROM ${EMBED_TABLE} WHERE embed_key = ? LIMIT 1`).bind(key).first()
  if (embed) return true
  const form = await d1.prepare('SELECT id FROM `eg_forms` WHERE `embed_key` = ? LIMIT 1').bind(key).first()
  return Boolean(form)
}

export type EmbedInput = { formId: number; name: string; enabled: boolean; allowedOrigins: string[]; theme: EmbedTheme }

/** Writes a new embed and returns its id. The caller has checked the permission and the form. */
export async function insertEmbed(input: EmbedInput & { embedKey: string }, now: Date = new Date()): Promise<number> {
  const d1 = await resolveD1Binding()
  const at = now.toISOString()
  const res = await d1
    .prepare(`INSERT INTO ${EMBED_TABLE} (form_id, name, embed_key, enabled, allowed_origins, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(input.formId, input.name, input.embedKey, input.enabled ? 1 : 0, JSON.stringify(input.allowedOrigins), JSON.stringify(input.theme), at, at)
    .run()
  return Number(res.meta?.last_row_id ?? 0)
}

/** Writes the editable fields of an embed. The key and the form never change, so a snippet already placed keeps working. */
export async function updateEmbedRow(id: number, input: EmbedInput, now: Date = new Date()): Promise<boolean> {
  const d1 = await resolveD1Binding()
  const res = await d1
    .prepare(`UPDATE ${EMBED_TABLE} SET name = ?, enabled = ?, allowed_origins = ?, theme = ?, updated_at = ? WHERE id = ?`)
    .bind(input.name, input.enabled ? 1 : 0, JSON.stringify(input.allowedOrigins), JSON.stringify(input.theme), now.toISOString(), id)
    .run()
  return (res.meta?.changes ?? 0) > 0
}
