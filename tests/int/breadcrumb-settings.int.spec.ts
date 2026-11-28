import { describe, expect, it } from 'vitest'

import { breadcrumbSchemaOn, DEFAULT_BREADCRUMBS, pickSeparator, resolveBreadcrumbs, resolveBreadcrumbsFor } from '@/features/seo/breadcrumbSettings'
import { buildBreadcrumbs } from '@/lib/templateWidgets'

describe('breadcrumb settings', () => {
  it('uses safe defaults for nothing or odd values', () => {
    expect(resolveBreadcrumbs(null)).toEqual(DEFAULT_BREADCRUMBS)
    expect(resolveBreadcrumbs({ breadcrumbs: { separator: '<script>', homeLabel: '   ', linkLast: 'yes', structuredData: null } })).toEqual(DEFAULT_BREADCRUMBS)
  })
  it('reads the saved values', () => {
    expect(resolveBreadcrumbs({ breadcrumbs: { separator: '›', homeLabel: ' Start  here ', linkLast: true, structuredData: false } })).toMatchObject({ separator: '›', homeLabel: 'Start here', linkLast: true, structuredData: false })
    expect(breadcrumbSchemaOn({ breadcrumbs: { structuredData: false } })).toBe(false)
    expect(breadcrumbSchemaOn(null)).toBe(true)
  })
  it('lets an element override the separator only with a known one', () => {
    expect(pickSeparator('|', '/')).toBe('|')
    expect(pickSeparator('', '›')).toBe('›')
    expect(pickSeparator('<b>', '/')).toBe('/')
  })
  it('puts the home label first', () => {
    expect(buildBreadcrumbs('/shop/candles', 'Candles', 'Start').map((c) => c.label)).toEqual(['Start', 'Shop', 'Candles'])
  })
  it('reads checked colours and a size, and drops odd ones', () => {
    const g = { breadcrumbs: { textColor: '#555', linkColor: 'red;x', fontSize: 'large' } }
    expect(resolveBreadcrumbs(g)).toMatchObject({ textColor: '#555', linkColor: '', fontSize: '1.15em' })
    expect(resolveBreadcrumbs({ breadcrumbs: { fontSize: 'huge' } }).fontSize).toBe('')
  })
  it('uses the saved settings only while SEO is on', () => {
    const settings = { breadcrumbs: { separator: '>', homeLabel: 'Start' } }
    expect(resolveBreadcrumbsFor({ enabled: true, settings }).homeLabel).toBe('Start')
    expect(resolveBreadcrumbsFor({ enabled: false, settings })).toEqual(DEFAULT_BREADCRUMBS)
    expect(resolveBreadcrumbsFor(null)).toEqual(DEFAULT_BREADCRUMBS)
  })
})
