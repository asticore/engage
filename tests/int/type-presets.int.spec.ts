import { describe, expect, it } from 'vitest'

import { addTypePreset, patchTypePreset, removeTypePreset, resetTab } from '@/admin/views/themeStyles/editorLogic'
import { buildThemeStylesCss, buildTypePresetsCss } from '@/features/themeStyles/css'
import { sanitizeThemeStyles, sanitizeTypePresets } from '@/features/themeStyles/sanitize'
import { DEFAULT_THEME_STYLES, DEFAULT_TYPE_PRESETS, LIMITS } from '@/features/themeStyles/types'
import { asBlockStyle, blockStyleClasses } from '@/lib/blockStyle'
import { V1_GROUP_OF } from '@/lib/design/v1Groups'
import { groupStoredV1Design } from '@/lib/design/storedGrouped'
import { GROUP_KEYS } from '@/views/visualEditor/designHelpers'
import { parseTypePresets } from '@/views/visualEditor/useTypePresets'

describe('typePresets sanitiser', () => {
  it('seeds the four defaults when the key is absent or not an array', () => {
    for (const input of [null, {}, { typePresets: 'x' }]) {
      const out = sanitizeThemeStyles(input).typePresets
      expect(out.map((p) => p.id)).toEqual(['primary', 'secondary', 'text', 'accent'])
      expect(out.map((p) => p.name)).toEqual(['Primary', 'Secondary', 'Text', 'Accent'])
    }
    expect(DEFAULT_THEME_STYLES.typePresets).toEqual(DEFAULT_TYPE_PRESETS)
  })

  it('keeps an explicit empty list empty', () => {
    expect(sanitizeThemeStyles({ typePresets: [] }).typePresets).toEqual([])
  })

  it('drops bad ids and duplicates, and caps at 12', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
    expect(sanitizeTypePresets(many)).toHaveLength(LIMITS.typePresets)
    const out = sanitizeTypePresets([{ id: 'Bad Id!' }, { id: '' }, { id: 'ok' }, { id: 'ok', name: 'dup' }, { id: 'x'.repeat(33) }, null, 4])
    expect(out.map((p) => p.id)).toEqual(['ok'])
  })

  it('clamps numbers and rejects bad enums and fonts', () => {
    const [p] = sanitizeTypePresets([
      { id: 'a', name: 'A', fontFamily: 'x;}body{color:red', fontSize: 9999, fontSizeUnit: 'pt', fontWeight: 450, lineHeight: 0, letterSpacing: 'abc', textTransform: 'evil' },
    ])
    expect(p).toEqual({ id: 'a', name: 'A', fontSize: 400, fontWeight: 500, lineHeight: 0.5 })
    const [q] = sanitizeTypePresets([{ id: 'b', fontFamily: 'heading', fontSize: 2, fontSizeUnit: 'rem', lineHeight: 1.3, letterSpacing: -1, textTransform: 'uppercase' }])
    expect(q).toMatchObject({ fontFamily: 'heading', fontSize: 2, fontSizeUnit: 'rem', lineHeight: 1.3, letterSpacing: -1, textTransform: 'uppercase' })
  })
})

describe('typePresets css', () => {
  it('emits one .tp-<id> rule per preset plus the heading inherit rule, and nothing for empty presets', () => {
    const css = buildTypePresetsCss(
      [{ id: 'big', name: 'Big', fontFamily: 'heading', fontSize: 2, fontSizeUnit: 'rem', fontWeight: 700, textTransform: 'uppercase' }, { id: 'none', name: 'None' }],
      new Map(),
    )
    expect(css).toContain('.tp-big{font-family:var(--font-display);font-size:2rem;font-weight:700;text-transform:uppercase;}')
    expect(css).toContain('.tp-big :is(h1,h2,h3,h4,h5,h6,button){font-family:inherit;font-size:inherit;font-weight:inherit;text-transform:inherit;}')
    expect(css).not.toContain('tp-none')
  })

  it('uses installed font stacks and is part of the site stylesheet exactly once', () => {
    const fonts = [{ id: 'my-font', family: 'My Font', category: 'sans-serif' }]
    const css = buildThemeStylesCss({ typePresets: [{ id: 'a', name: 'A', fontFamily: 'my-font' }] }, { saved: false }, { fonts: fonts as never })
    expect(css.match(/\.tp-a\{/g)).toHaveLength(1)
    expect(css).toContain('My Font')
    // Seeds are emitted on a fresh install and only name theme fonts.
    const fresh = buildThemeStylesCss(null, { saved: false })
    expect(fresh).toContain('.tp-primary{font-family:var(--font-display);}')
    expect(fresh).toContain('.tp-text{font-family:var(--font-body);}')
  })

  it('never lets hostile values reach the stylesheet', () => {
    const css = buildThemeStylesCss(
      { typePresets: [{ id: 'a</style><b', name: 'x' }, { id: 'ok', name: '</style>', fontFamily: 'a}{color:red', fontSize: '1;color:red', textTransform: 'x;y' }] },
      { saved: true },
    )
    expect(css).not.toMatch(/color:red/)
    expect(css).not.toContain('</style')
    expect(css).not.toContain('tp-a')
  })
})

describe('BlockStyle.typePreset', () => {
  it('is kept when it is a slug and dropped otherwise', () => {
    expect(asBlockStyle({ typePreset: 'primary' }).typePreset).toBe('primary')
    expect(asBlockStyle({ typePreset: 'Bad Id' }).typePreset).toBeUndefined()
    expect(asBlockStyle({ typePreset: '"><x' }).typePreset).toBeUndefined()
    expect(asBlockStyle({ typePreset: 5 }).typePreset).toBeUndefined()
  })

  it('adds class tp-<id> to the wrapper next to customClass', () => {
    const cls = blockStyleClasses(asBlockStyle({ typePreset: 'accent', customClass: 'mine' }))
    expect(cls).toContain('tp-accent')
    expect(cls).toContain('mine')
    expect(blockStyleClasses(asBlockStyle({}))).not.toContain('tp-')
    expect(blockStyleClasses({ typePreset: 'a b' } as never)).not.toContain('tp-')
  })

  it('keeps per-block typography as inline styles, which beat the class', () => {
    const style = asBlockStyle({ typePreset: 'text', fontSize: 30, fontWeight: 700 })
    expect(style.fontSize).toBe(30)
    expect(blockStyleClasses(style)).toContain('tp-text')
  })

  it('belongs to the typography design group and survives grouping', () => {
    expect(V1_GROUP_OF.typePreset).toBe('typography')
    expect(GROUP_KEYS.typography).toContain('typePreset')
    const grouped = groupStoredV1Design({ typePreset: 'primary', fontSize: 20 })
    expect(JSON.stringify(grouped)).toContain('typePreset')
  })
})

describe('Text styles editor helpers and picker data', () => {
  it('adds with a unique id, patches, unsets and removes', () => {
    let list = addTypePreset(DEFAULT_TYPE_PRESETS, 'Primary')
    expect(list.map((p) => p.id)).toContain('primary-2')
    list = patchTypePreset(list, 'primary-2', { fontSize: 20, name: 'Hero', id: 'hack' })
    expect(list.find((p) => p.id === 'primary-2')).toMatchObject({ name: 'Hero', fontSize: 20 })
    list = patchTypePreset(list, 'primary-2', { fontSize: undefined })
    expect(list.find((p) => p.id === 'primary-2')?.fontSize).toBeUndefined()
    list = removeTypePreset(list, 'primary-2')
    expect(list).toEqual(DEFAULT_TYPE_PRESETS)
  })

  it('caps adding at the limit', () => {
    const full = sanitizeTypePresets(Array.from({ length: 12 }, (_, i) => ({ id: `p${i}` })))
    expect(addTypePreset(full, 'More')).toHaveLength(12)
  })

  it('resets the typography tab to the seed presets', () => {
    const changed = { ...DEFAULT_THEME_STYLES, typePresets: [] as typeof DEFAULT_TYPE_PRESETS }
    expect(resetTab(changed, 'typography').typePresets).toEqual(DEFAULT_TYPE_PRESETS)
  })

  it('parses the public route data defensively', () => {
    expect(parseTypePresets(null)).toEqual([])
    expect(parseTypePresets({ typePresets: [{ id: 'a', name: 'A' }, { id: 'Bad id' }, { id: 'b' }, null] })).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'b' },
    ])
  })
})
