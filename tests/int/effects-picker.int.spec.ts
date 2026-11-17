import { describe, expect, it } from 'vitest'

import { applyEffect, currentEffect, EFFECT_CATALOG, effectById, readEffectOptions } from '@/features/effects/catalog'

describe('effects picker model', () => {
  it('lists the Effix effects with unique ids and classes, including diagrams and every chart type', () => {
    const ids = EFFECT_CATALOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(EFFECT_CATALOG.map((e) => e.className)).size).toBe(ids.length)
    expect(ids.filter((id) => id.startsWith('chart-')).length).toBeGreaterThanOrEqual(20)
    expect(ids.filter((id) => id.startsWith('diagram-')).length).toBeGreaterThanOrEqual(5)
    expect(EFFECT_CATALOG.every((e) => e.className === `efx-${e.id}`)).toBe(true)
  })
  it('adds the class and options and keeps what was already there', () => {
    const out = applyEffect({ cssClasses: 'hero shadowed', customAttrs: 'aria-label|Counter' }, 'counter', { duration: '3' })
    expect(out.cssClasses).toBe('hero shadowed efx-counter')
    expect(out.customAttrs).toBe('aria-label|Counter\ndata-efx-duration|3')
    expect(currentEffect(out.cssClasses)?.id).toBe('counter')
    expect(readEffectOptions(effectById('counter')!, out.customAttrs)).toEqual({ duration: '3' })
  })
  it('swaps effects and removes the old options', () => {
    const first = applyEffect({}, 'counter', { duration: '3' })
    const second = applyEffect(first, 'popup', { frequency: 'session' })
    expect(second.cssClasses).toBe('efx-popup')
    expect(second.customAttrs).toBe('data-efx-frequency|session')
  })
  it('None removes the effect and leaves other fields', () => {
    const first = applyEffect({ cssClasses: 'a', customAttrs: 'role|note' }, 'countdown', { to: '2027-01-01T00:00' })
    expect(applyEffect(first, null)).toEqual({ cssClasses: 'a', customAttrs: 'role|note' })
    expect(applyEffect(applyEffect({}, 'shimmer'), null)).toEqual({ cssClasses: undefined, customAttrs: undefined })
  })
  it('drops empty values and line breaks, and respects the limits', () => {
    expect(applyEffect({}, 'toast', { duration: '' }).customAttrs).toBeUndefined()
    expect(applyEffect({}, 'toast', { duration: '4\nx|y' }).customAttrs).toBe('data-efx-duration|4 x y')
    const eight = 'a b c d e f g h'
    expect(applyEffect({ cssClasses: eight }, 'shimmer').cssClasses?.split(' ')).toHaveLength(8)
  })
})
