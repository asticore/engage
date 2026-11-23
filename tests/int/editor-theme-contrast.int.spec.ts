/**
 * Task 12 (31a, 31b): the editor's light and dark palettes, the admin's dark blue ramp and every filled
 * button pair must pass WCAG AA, and the canvas root must not take editor colours.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { contrastRatio, parseHex } from '@/views/visualEditor/designWarnings'
import { VISUAL_EDITOR_CSS } from '@/views/visualEditor/visualEditor.styles'

function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {')
  if (start < 0) throw new Error('no block ' + selector)
  const end = css.indexOf('\n}', start)
  const out: Record<string, string> = {}
  for (const m of css.slice(start, end).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2]
  return out
}

const ratio = (a: string, b: string) => {
  const x = parseHex(a)
  const y = parseHex(b)
  if (!x || !y) throw new Error(`bad colour ${a} ${b}`)
  return contrastRatio(x, y)
}

const light = block(VISUAL_EDITOR_CSS, ':root,\n.ve-root')
const dark = { ...light, ...block(VISUAL_EDITOR_CSS, "html[data-theme='dark'] .ve-root") }

// Button rule: a filled button's text and fill are opposites that pass 4.5:1.
const BUTTON_PAIRS: Array<[string, string]> = [
  ['--ve-accent-contrast', '--ve-accent'],
  ['--ve-accent-contrast', '--ve-accent-hover'],
  ['--ve-danger-contrast', '--ve-danger'],
  ['--ve-select-contrast', '--ve-select'],
  ['--ve-select-contrast', '--ve-select-hover'],
  ['--ve-chrome-text', '--ve-chrome-bg'],
]
const TEXT_PAIRS: Array<[string, string]> = [
  ['--ve-text', '--ve-bg'],
  ['--ve-text', '--ve-surface'],
  ['--ve-text', '--ve-surface-alt'],
  ['--ve-text', '--ve-surface-hover'],
  ['--ve-text-muted', '--ve-surface'],
  ['--ve-text-muted', '--ve-bg'],
]

describe.each([['light', light], ['dark', dark]] as const)('editor %s theme', (_name, tokens) => {
  it.each(BUTTON_PAIRS)('button %s on %s passes 4.5:1', (fg, bg) => {
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(TEXT_PAIRS)('text %s on %s passes 4.5:1', (fg, bg) => {
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5)
  })
  it('accent focus ring and strong borders pass 3:1 on the surface', () => {
    expect(ratio(tokens['--ve-accent']!, tokens['--ve-surface']!)).toBeGreaterThanOrEqual(3)
  })
})

describe('admin dark blue ramp', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/(engage)/custom.css'), 'utf8')
  const navy: Record<string, string> = {}
  for (const m of css.matchAll(/--ac-navy-(\d+):\s*(#[0-9a-f]{6});/g)) navy[m[1]!] = m[2]!
  it('has the full ramp', () => {
    expect(Object.keys(navy)).toHaveLength(14)
  })
  it.each(['0', '50', '100'])('text steps pass 4.5:1 on navy %s', (step) => {
    for (const fg of ['400', '500', '600', '700', '800', '900', '1000']) {
      expect(ratio(navy[fg]!, navy[step]!)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it.each(['0', '50'])('border step 300 passes 3:1 on navy %s', (step) => {
    expect(ratio(navy['300']!, navy[step]!)).toBeGreaterThanOrEqual(3)
  })
  it('both dark blocks map elevation to the blue ramp', () => {
    expect(css.match(/--theme-elevation-0: var\(--ac-navy-0\)/g)?.length).toBe(2)
    expect(css).not.toMatch(/\[data-theme='dark'\] \{[^}]*--color-base-/)
  })
})

describe('canvas root', () => {
  it('uses the site page colours and a light scheme, not editor tokens', () => {
    const i = VISUAL_EDITOR_CSS.indexOf('.ve-frame-root {')
    const rule = VISUAL_EDITOR_CSS.slice(i, VISUAL_EDITOR_CSS.indexOf('}', i))
    expect(rule).toContain('color-scheme: light')
    expect(rule).not.toContain('--ve-')
  })
})
