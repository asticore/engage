import { describe, expect, it } from 'vitest'

import { buttonClassName } from '@/components/blocks/elements/ButtonElement'

describe('button hover effect class', () => {
  it('adds a known effect and ignores unknown values', () => {
    expect(buttonClassName('primary', undefined, undefined, 'shine')).toContain('btn--fx-shine')
    expect(buttonClassName('primary', undefined, undefined, 'evil"x')).not.toContain('fx')
    expect(buttonClassName('primary')).toBe('btn btn--primary')
  })
})
