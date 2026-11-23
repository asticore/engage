import { describe, expect, it } from 'vitest'

import { asBlockStyle, blockFxClasses, blockStyleToCss } from '@/lib/blockStyle'

describe('animated gradient background', () => {
  const base = { bgType: 'gradient' as const, bgGradientFrom: '#111111', bgGradientTo: '#2e3192' }
  it('keeps valid speeds and drops others', () => {
    expect(asBlockStyle({ ...base, bgGradientFlow: 'slow' }).bgGradientFlow).toBe('slow')
    expect(asBlockStyle({ ...base, bgGradientFlow: 'warp' }).bgGradientFlow).toBeUndefined()
  })
  it('adds the classes and the oversized background only for a gradient', () => {
    const s = asBlockStyle({ ...base, bgGradientFlow: 'fast' })
    expect(blockFxClasses(s)).toContain('be-fx-gflow be-fx-gflow--fast')
    expect(blockStyleToCss(s).backgroundSize).toBe('300% 300%')
    const plain = asBlockStyle({ bgType: 'color', bgColor: '#fff', bgGradientFlow: 'fast' })
    expect(blockFxClasses(plain)).not.toContain('be-fx-gflow')
    expect(blockStyleToCss(asBlockStyle(base)).backgroundSize).toBeUndefined()
  })
})
