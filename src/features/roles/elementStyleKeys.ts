/**
 * Which props of an element are styling and which are text or content. A user who may edit text but
 * not style (the content.editStyle permission) keeps the stored styling props when they save: the
 * element's `props` are split by key, and only the content keys take the user's edits.
 *
 * A prop is styling when its field is a visual type (colour, spacing, type, shadow, gradient) or its
 * name is one of the styling names below (a choice such as a variant or an alignment). Everything else
 * is content. An element type that is not in the registry has no styling keys, so nothing is restored
 * for it (its props are handled as content, as before).
 */

import { getElementDef } from '@/lib/elements/registry'

/** Field types that only ever change how something looks. */
const STYLE_FIELD_TYPES = new Set(['color', 'dimensions', 'typography', 'shadow', 'gradient'])

/** Prop names that are styling even when their field is a plain choice or text field. */
const STYLE_PROP_NAMES = new Set(['variant', 'style', 'align', 'alignment', 'theme', 'tone', 'size', 'background', 'border', 'radius', 'padding', 'margin'])

/** The styling prop names of one element type, from its registry definition. */
export function elementStyleKeys(elementType: unknown): string[] {
  if (typeof elementType !== 'string' || !elementType) return []
  const def = getElementDef(elementType)
  if (!def) return []
  return def.fields
    .filter((field) => STYLE_FIELD_TYPES.has(field.type) || STYLE_PROP_NAMES.has(field.name))
    .map((field) => field.name)
}

/**
 * The incoming props with the styling keys put back to their stored values (or removed when the stored
 * element had none). Content keys are left exactly as the user sent them.
 */
export function restoreStyleProps(incoming: unknown, original: unknown, styleKeys: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...((incoming as Record<string, unknown> | null) ?? {}) }
  const stored = (original as Record<string, unknown> | null) ?? {}
  for (const key of styleKeys) {
    if (key in stored) next[key] = stored[key]
    else delete next[key]
  }
  return next
}
