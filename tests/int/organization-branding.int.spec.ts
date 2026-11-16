// @vitest-environment node
// Company theming and portal layout (Task 22c): the pure rules, and the service on an in-memory SQLite store.

import { describe, expect, it } from 'vitest'

import {
  BRANDING_FONTS,
  PORTAL_SECTIONS,
  brandingCss,
  brandingInputFromForm,
  keepBrandingKeys,
  plainMetadata,
  sanitiseBranding,
  sanitiseLayout,
  visibleSections,
  withBrandingAndLayout,
  EMPTY_BRANDING,
} from '@/features/organizations/branding'

describe('sanitiseBranding', () => {
  it('keeps real colours and known fonts, drops everything else', () => {
    const b = sanitiseBranding({ primary: '#1A73E8', accent: 'red; } body{display:none', background: '@brand', text: 'rgb(1, 2, 3)', headingFont: 'serif', bodyFont: 'url(x)' })
    expect(b.primary).toBe('#1a73e8')
    expect(b.accent).toBe('')
    expect(b.background).toBe('') // a site colour reference is not a company colour
    expect(b.text).toBe('rgb(1, 2, 3)')
    expect(b.headingFont).toBe('serif')
    expect(b.bodyFont).toBe('default')
  })
  it('treats junk input as empty', () => {
    expect(sanitiseBranding(null)).toEqual(EMPTY_BRANDING)
    expect(sanitiseBranding([])).toEqual(EMPTY_BRANDING)
  })
})

describe('sanitiseLayout', () => {
  it('repairs unknown, repeated and missing sections', () => {
    const l = sanitiseLayout({ order: ['roles', 'nope', 'roles', 'members'], hidden: ['teams', 'details', 'bogus'] })
    expect(l.order.slice(0, 2)).toEqual(['roles', 'members'])
    expect([...l.order].sort()).toEqual([...PORTAL_SECTIONS].sort())
    expect(l.hidden).toEqual(['teams']) // details cannot be hidden
  })
  it('hides sections without losing order', () => {
    expect(visibleSections({ order: [...PORTAL_SECTIONS], hidden: ['teams'] })).not.toContain('teams')
  })
})

describe('brandingCss', () => {
  it('is empty when nothing is set', () => {
    expect(brandingCss(EMPTY_BRANDING)).toBe('')
  })
  it('only emits validated values, scoped to .org-portal', () => {
    const css = brandingCss(sanitiseBranding({ primary: '#112233', accent: '</style><script>', headingFont: 'mono' }))
    expect(css).toContain('--org-primary:#112233')
    expect(css).toContain(BRANDING_FONTS.mono)
    expect(css).not.toContain('<')
    expect(css.split('\n').every((line) => line.startsWith('.org-portal'))).toBe(true)
  })
})

describe('metadata handling', () => {
  const b = sanitiseBranding({ primary: '#112233' })
  const l = sanitiseLayout({ order: ['teams', 'members'] })
  it('writes branding and layout and keeps other keys', () => {
    const text = withBrandingAndLayout('{"industry":"retail"}', b, l) as string
    const parsed = JSON.parse(text)
    expect(parsed.industry).toBe('retail')
    expect(parsed.branding.primary).toBe('#112233')
    expect(parsed.layout.order[0]).toBe('teams')
  })
  it('removes the keys again when everything is default', () => {
    const text = withBrandingAndLayout(withBrandingAndLayout('{"a":1}', b, l), EMPTY_BRANDING, sanitiseLayout(null))
    expect(text).toBe('{"a":1}')
  })
  it('refuses a result over the metadata limit', () => {
    expect(withBrandingAndLayout(JSON.stringify({ big: 'x'.repeat(3990) }), b, l)).toBeNull()
  })
  it('a free-form edit cannot overwrite or wipe branding', () => {
    const stored = withBrandingAndLayout('{"a":1}', b, l)
    const next = JSON.parse(keepBrandingKeys('{"a":2,"branding":{"primary":"#ff0000"}}', stored) as string)
    expect(next.a).toBe(2)
    expect(next.branding.primary).toBe('#112233')
    expect(JSON.parse(keepBrandingKeys(null, stored) as string).branding.primary).toBe('#112233')
    expect(plainMetadata(next)).toEqual({ a: 2 })
  })
})

describe('brandingInputFromForm', () => {
  it('orders sections by position and hides unchecked ones', () => {
    const fields: Record<string, string> = { primary: '#fff', headingFont: 'serif', bodyFont: '', pos_members: '3', pos_teams: '1', show_members: 'yes', show_details: 'yes' }
    const input = brandingInputFromForm({ get: (name) => fields[name] ?? null })
    expect(input.layout.order.slice(0, 2)).toEqual(['teams', 'members'])
    expect(input.layout.hidden).toContain('teams')
    expect(input.layout.hidden).not.toContain('members')
  })
})

