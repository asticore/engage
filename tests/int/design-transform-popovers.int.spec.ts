import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('transform popover groups', () => {
  const src = readFileSync('src/views/visualEditor/DesignPanel.tsx', 'utf8')
  it('groups rotate, offset, scale and skew, each with Normal and Hover rows', () => {
    for (const id of ["'rotate'", "'offset'", "'scale'", "'skew'"]) expect(src).toContain(`id: ${id}`)
    expect(src).toContain('TRANSFORM_POPOVERS.map')
    expect(src).toContain("tfKey('tfh', r.suffix)")
    expect(src).toContain("tfKey('tf', r.suffix)")
  })
})
