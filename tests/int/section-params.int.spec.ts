import { describe, expect, it } from 'vitest'

import { applyParams, coerceParamValue, findParamDecls, makeParametric, overriddenKeys, parseParamDecls, resolveParamValues } from '@/lib/sectionParams'
import { tagReusableSections } from '@/lib/reusableSection'
import { getElementDef } from '@/lib/elements/registry'
import { SITE_ELEMENT_TYPES } from '@/lib/elements/wave38Defs'
import type { SectionNode } from '@/lib/sectionTree'

const el = (elementType: string, props: Record<string, unknown>) => ({ blockType: 'element', elementType, props })
const pricingCard = (background = '#ffffff') => ({
  blockType: 'section',
  design: { bgColor: background },
  columns: [{ blocks: [el('heading', { text: 'Starter', tag: 'h3' }), el('text-editor', { content: { root: { children: [{ type: 'text', text: '$9' }] } } }), el('button', { text: 'Join', url: '/signup' })] }],
})

describe('reusable section inputs (Task 13 / 32c)', () => {
  it('the two elements exist and are rendered on the server', () => {
    expect(getElementDef('section-params')).toBeTruthy()
    expect(getElementDef('section-instance')).toBeTruthy()
    expect(SITE_ELEMENT_TYPES.has('section-instance')).toBe(true)
  })

  it('declarations are cleaned: bad or repeated keys are dropped, at most 12', () => {
    const rows = [{ key: 'title', type: 'text' }, { key: 'Title', type: 'text' }, { key: 'title', type: 'link' }, { key: '1x' }, { key: 'size', type: 'choice', choices: 'S, M, L', default: 'XL' }]
    const decls = parseParamDecls(rows)
    expect(decls.map((d) => d.key)).toEqual(['title', 'size'])
    expect(decls[1]).toMatchObject({ type: 'choice', choices: ['S', 'M', 'L'] })
    expect(decls[1].default).toBeUndefined()
    expect(parseParamDecls(Array.from({ length: 30 }, (_, i) => ({ key: `k${i}` })))).toHaveLength(12)
  })

  it('every value type is checked against its declaration', () => {
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'number' }, '12.5')).toBe(12.5)
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'number' }, 'abc')).toBeUndefined()
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'image' }, '42')).toBe(42)
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'colour' }, '#2e3192')).toBe('#2e3192')
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'colour' }, 'red;background:url(x)')).toBeUndefined()
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'link' }, '/shop')).toBe('/shop')
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'link' }, 'javascript:alert(1)')).toBeUndefined()
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'link' }, '//evil.example')).toBeUndefined()
    expect(coerceParamValue({ key: 'a', label: 'a', type: 'choice', choices: ['S', 'M'] }, 'L')).toBeUndefined()
  })

  it('a token that is a whole value keeps its type, a token in text becomes text', () => {
    const values = { n: 7, who: 'Ana' }
    expect(applyParams({ limit: '{{param:n}}', text: 'Hi {{param:who}}!', other: '{{title}}', gone: '{{param:nope}}' }, values)).toEqual({ limit: 7, text: 'Hi Ana!', other: '{{title}}', gone: '' })
  })

  it('a pricing card saved with three inputs is used twice with different values, and a layout change reaches both', () => {
    const made = makeParametric([pricingCard()], [
      { key: 'plan', label: 'Plan name', type: 'text', find: 'Starter' },
      { key: 'price', label: 'Price', type: 'text', find: '$9' },
      { key: 'signup', label: 'Sign up link', type: 'link', find: '/signup' },
    ])
    expect(made.decls.map((d) => d.key)).toEqual(['plan', 'price', 'signup'])
    expect(made.replaced).toEqual({ plan: 1, price: 1, signup: 1 })
    const source = [el('section-params', { params: made.decls }), ...made.blocks]
    const decls = findParamDecls(source)
    expect(decls).toHaveLength(3)

    const render = (blocks: unknown[], overrides: unknown) => JSON.stringify(applyParams(blocks, resolveParamValues(findParamDecls(blocks), overrides)))
    const a = render(source, { plan: 'Pro', price: '$29' })
    const b = render(source, { plan: 'Team', signup: '/contact' })
    expect(a).toContain('Pro')
    expect(a).toContain('$29')
    expect(a).toContain('/signup') // not overridden: follows the source default
    expect(b).toContain('Team')
    expect(b).toContain('$9')
    expect(b).toContain('/contact')
    expect(a).not.toContain('{{param')

    // The layout of the source changes once; both uses show it.
    const changed = made.blocks.map((block) => ({ ...(block as object), design: { bgColor: '#111111' } }))
    const sourceV2 = [el('section-params', { params: made.decls }), ...changed]
    expect(render(sourceV2, { plan: 'Pro' })).toContain('#111111')
    expect(render(sourceV2, { plan: 'Team' })).toContain('#111111')
    expect(render(sourceV2, { plan: 'Team' })).toContain('Team')
  })

  it('a changed default in the source reaches an instance that did not override it', () => {
    const v1 = [el('section-params', { params: [{ key: 'plan', type: 'text', default: 'Starter' }] }), el('heading', { text: '{{param:plan}}' })]
    const v2 = [el('section-params', { params: [{ key: 'plan', type: 'text', default: 'Basic' }] }), el('heading', { text: '{{param:plan}}' })]
    const out = (blocks: unknown[]) => JSON.stringify(applyParams(blocks, resolveParamValues(findParamDecls(blocks), {})))
    expect(out(v1)).toContain('Starter')
    expect(out(v2)).toContain('Basic')
  })

  it('overrides are only the declared, valid ones', () => {
    const decls = parseParamDecls([{ key: 'a', type: 'number' }, { key: 'b', type: 'text' }])
    expect(overriddenKeys(decls, { a: 'x', b: 'y', zzz: 1 })).toEqual(['b'])
  })

  it('declarations are found inside nested sections', () => {
    const nested = [{ blockType: 'section', columns: [{ blocks: [el('section-params', { params: [{ key: 'k' }] })] }] }]
    expect(findParamDecls(nested).map((d) => d.key)).toEqual(['k'])
  })

  it('an instance carries the chain, so a section that contains itself cannot loop', () => {
    const [tagged] = tagReusableSections([el('section-instance', { section: 3 }) as unknown as SectionNode], [3])
    expect((tagged as unknown as { _chain: number[] })._chain).toEqual([3])
  })
})
