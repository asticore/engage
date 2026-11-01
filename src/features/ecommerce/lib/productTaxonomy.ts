/**
 * Brand and tags of a product for the storefront. The product page reads them with depth 1, so each is an object
 * with a name; an id that was not populated is skipped rather than shown as a number.
 */

const nameOf = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null
  const name = (value as { name?: unknown }).name
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  return trimmed ? trimmed : null
}

export function brandName(brand: unknown): string | null {
  return nameOf(brand)
}

/** Tag names in the order they were picked, without repeats. */
export function tagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const out: string[] = []
  for (const tag of tags) {
    const name = nameOf(tag)
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** Fills the one placeholder of a translated line ({name} or {tags}). The value is inserted as text, never as a pattern. */
export function fillLine(template: string, value: string): string {
  return template.replace(/\{(?:name|tags)\}/, () => value)
}
