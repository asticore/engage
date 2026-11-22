/**
 * Templates follow the theme (Task 14, 33d). A library item uses Shine colour tokens, written
 * `var(--sh-primary)` (also `var(--shine-primary)` or `var(--eg-c-primary)`), instead of fixed colours.
 * On insert each token becomes the site's own theme colour reference (`@primary`, drawn from `--eg-c-primary`),
 * so the inserted section picks up the site's colours and its dark value under [data-theme="dark"].
 *
 * An item may also list fixed colours it was drawn with, as `requires.colours` (a map from a hex colour to a
 * colour id, for example {"#0a84ff": "primary"}). Those hex values are swapped the same way. A colour id the
 * site does not have is left as written. Pure functions, no database access.
 */

const TOKEN_RE = /var\(\s*--(?:sh|shine|eg-c)-([a-z0-9-]{1,32})\s*(?:,[^)]*)?\)/gi
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export type ThemeMapOptions = {
  /** The colour ids the site's theme defines. */
  siteColourIds: readonly string[]
  /** Hex colour (any case) to colour id, from the item's `requires.colours`. */
  hexMap?: Record<string, string>
}

export type ThemeMapResult<T> = { tree: T; mapped: number }

/** Reads `requires.colours` safely: only hex keys and slug values survive. */
export function readColourMap(requires: unknown): Record<string, string> {
  const raw = requires && typeof requires === 'object' ? (requires as { colours?: unknown }).colours : undefined
  const map: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map
  for (const [hex, id] of Object.entries(raw as Record<string, unknown>)) {
    if (HEX_RE.test(hex) && typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id)) map[hex.toLowerCase()] = id
  }
  return map
}

/** Maps one string value: a whole-string token or hex becomes `@id`; tokens inside longer text (gradients, shadows) become `var(--eg-c-id)`. */
export function mapColourString(value: string, options: ThemeMapOptions): { value: string; mapped: number } {
  const ids = new Set(options.siteColourIds)
  const trimmed = value.trim()
  if (HEX_RE.test(trimmed)) {
    const id = options.hexMap?.[trimmed.toLowerCase()]
    return id && ids.has(id) ? { value: `@${id}`, mapped: 1 } : { value, mapped: 0 }
  }
  let mapped = 0
  const whole = /^var\(\s*--(?:sh|shine|eg-c)-([a-z0-9-]{1,32})\s*(?:,[^)]*)?\)$/i.exec(trimmed)
  if (whole) {
    const id = whole[1].toLowerCase()
    return ids.has(id) ? { value: `@${id}`, mapped: 1 } : { value, mapped: 0 }
  }
  const replaced = value.replace(TOKEN_RE, (match, rawId: string) => {
    const id = rawId.toLowerCase()
    if (!ids.has(id)) return match
    mapped += 1
    return `var(--eg-c-${id})`
  })
  return { value: replaced, mapped }
}

/** Walks a template tree and maps every string value. The input is not changed. */
export function mapTemplateTokens<T>(tree: T, options: ThemeMapOptions): ThemeMapResult<T> {
  let mapped = 0
  const walk = (node: unknown, depth: number): unknown => {
    if (depth > 40) return node
    if (typeof node === 'string') {
      const result = mapColourString(node, options)
      mapped += result.mapped
      return result.value
    }
    if (Array.isArray(node)) return node.map((child) => walk(child, depth + 1))
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) out[key] = walk(child, depth + 1)
      return out
    }
    return node
  }
  return { tree: walk(tree, 0) as T, mapped }
}
