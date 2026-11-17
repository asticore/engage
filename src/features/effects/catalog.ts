/**
 * Effix effects the visual editor picker offers (asticore/effix, reference/references.json). Picking an effect adds its
 * `efx-` class to the block's CSS classes and its options as `data-efx-*` attributes, the same two fields the Design
 * panel already has, so nothing new is stored and an effect can still be typed by hand.
 *
 * The list is generated from the Effix `.meta.js` files at the commit pinned in reference/references.json
 * (`node scripts/gen-effect-catalog.cjs <effix checkout> <commit>`, output in `catalogData.ts`). Anything not
 * listed stays usable through the CSS classes field.
 */

import { EFFECT_DATA } from './catalogData'

export type EffectOption = {
  /** The attribute name without the `data-efx-` prefix. */
  attr: string
  label: string
  type: 'number' | 'text' | 'select' | 'boolean'
  values?: string[]
  placeholder?: string
}

export type EffectDef = {
  id: string
  label: string
  /** The Effix group the effect is listed under (Scroll, Text, Charts and so on). */
  group: string
  className: string
  help: string
  options: EffectOption[]
}

export const EFFECT_CATALOG: EffectDef[] = EFFECT_DATA

const ATTR_PREFIX = 'data-efx-'
const MAX_CLASSES = 8
const MAX_ATTRS = 10

export const effectById = (id: string): EffectDef | undefined => EFFECT_CATALOG.find((e) => e.id === id)

const splitClasses = (value: string | undefined): string[] => (value ?? '').split(/\s+/).filter(Boolean)
const splitAttrs = (value: string | undefined): string[] => (value ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

/** The catalogue effect a block's CSS classes currently use, or null. */
export function currentEffect(cssClasses: string | undefined): EffectDef | null {
  const classes = splitClasses(cssClasses)
  return EFFECT_CATALOG.find((e) => classes.includes(e.className)) ?? null
}

/** Option values currently set in the custom attributes for an effect. */
export function readEffectOptions(effect: EffectDef, customAttrs: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of splitAttrs(customAttrs)) {
    const at = line.indexOf('|')
    if (at < 0) continue
    const name = line.slice(0, at)
    const attr = effect.options.find((o) => `${ATTR_PREFIX}${o.attr}` === name)
    if (attr) out[attr.attr] = line.slice(at + 1)
  }
  return out
}

const stripEffect = (effect: EffectDef, cssClasses: string | undefined, customAttrs: string | undefined) => ({
  classes: splitClasses(cssClasses).filter((c) => c !== effect.className),
  attrs: splitAttrs(customAttrs).filter((line) => !effect.options.some((o) => line.startsWith(`${ATTR_PREFIX}${o.attr}|`))),
})

/**
 * The new `cssClasses` and `customAttrs` after choosing an effect (or none) and its option values. Other classes and
 * attributes are kept, a previous catalogue effect is removed first, empty option values are left out, and the field
 * limits the saved style enforces (8 classes, 10 attributes) are respected.
 */
export function applyEffect(
  current: { cssClasses?: string; customAttrs?: string },
  effectId: string | null,
  options: Record<string, string> = {},
): { cssClasses: string | undefined; customAttrs: string | undefined } {
  let classes = splitClasses(current.cssClasses)
  let attrs = splitAttrs(current.customAttrs)
  for (const e of EFFECT_CATALOG) {
    const stripped = stripEffect(e, classes.join(' '), attrs.join('\n'))
    classes = stripped.classes
    attrs = stripped.attrs
  }
  const effect = effectId ? effectById(effectId) : undefined
  if (effect) {
    classes = [...classes, effect.className].slice(-MAX_CLASSES)
    for (const option of effect.options) {
      const raw = (options[option.attr] ?? '').replace(/[\r\n|]/g, ' ').trim()
      if (raw && attrs.length < MAX_ATTRS) attrs.push(`${ATTR_PREFIX}${option.attr}|${raw}`)
    }
  }
  return { cssClasses: classes.join(' ') || undefined, customAttrs: attrs.join('\n') || undefined }
}
