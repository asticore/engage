import { describe, expect, it } from 'vitest'

import {
  addSource,
  applyNonce,
  makeNonce,
  applyBuilder,
  blockedSource,
  builderHeaders,
  builderWarnings,
  directiveForViolation,
  EMPTY_CSP_BUILDER,
  isReportNoise,
  normaliseConfig,
  parseReports,
  suggestionFor,
  validateBuilder,
  type CspBuilderConfig,
} from '@/features/security/cspBuilder'
import { DEFAULT_CONTENT_SECURITY_POLICY, securityHeaders } from '@/features/security/headers'
import { DEFAULT_SECURITY_SETTINGS } from '@/features/security/settings'

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `) || d === name) ?? ''
const cfg = (over: Partial<CspBuilderConfig>): CspBuilderConfig => ({ ...EMPTY_CSP_BUILDER, ...over })
const enabled = { ...DEFAULT_SECURITY_SETTINGS, featureEnabled: true }

describe('csp builder config', () => {
  it('drops unknown directives, empty entries and duplicates', () => {
    const c = normaliseConfig({ mode: 'enforce', directives: { 'script-src': { sources: ['https://a.com', 'https://a.com', ' '], replace: true }, 'bogus-src': { sources: ['x'] }, 'img-src': { sources: [] } } })
    expect(c.mode).toBe('enforce')
    expect(Object.keys(c.directives)).toEqual(['script-src'])
    expect(c.directives['script-src']).toEqual({ sources: ['https://a.com'], replace: true })
  })
  it('treats junk as the off config', () => {
    expect(normaliseConfig(null).mode).toBe('off')
    expect(normaliseConfig({ mode: 'weird' }).mode).toBe('off')
  })
  it('validates sources with the free-text rules', () => {
    expect(validateBuilder(cfg({ directives: { 'img-src': { sources: ['https://ok.example.com'], replace: false } } }))).toBeNull()
    expect(validateBuilder(cfg({ directives: { 'img-src': { sources: ['not a host!'], replace: false } } }))).toContain('img-src')
    expect(validateBuilder(cfg({ directives: { 'img-src': { sources: ["'none'", 'https://a.com'], replace: false } } }))).toContain("'none'")
  })
  it('warns about risky choices', () => {
    expect(builderWarnings(cfg({ directives: { 'script-src': { sources: ['*'], replace: false } } })).join(' ')).toContain('any host')
    expect(builderWarnings(cfg({ directives: { 'script-src': { sources: ["'self'"], replace: true } } })).join(' ')).toContain("'unsafe-inline'")
    expect(builderWarnings(cfg({ mode: 'enforce' })).join(' ')).toContain('report-only')
  })
})

describe('csp builder policy', () => {
  it('adds sources to the default and keeps its hosts', () => {
    const out = applyBuilder(DEFAULT_CONTENT_SECURITY_POLICY, cfg({ directives: { 'script-src': { sources: ['https://js.stripe.com'], replace: false } } }))
    const script = directive(out, 'script-src')
    expect(script).toContain('https://js.stripe.com')
    expect(script).toContain('https://www.googletagmanager.com')
    expect(directive(out, 'font-src')).toContain('https://fonts.gstatic.com')
  })
  it('replaces a directive when asked, and adds missing ones', () => {
    const out = applyBuilder(DEFAULT_CONTENT_SECURITY_POLICY, cfg({ directives: { 'img-src': { sources: ["'self'"], replace: true }, 'worker-src': { sources: ["'self'", 'blob:'], replace: false } } }))
    expect(directive(out, 'img-src')).toBe("img-src 'self'")
    expect(directive(out, 'worker-src')).toBe("worker-src 'self' blob:")
  })
  it("lets a lone 'none' lock a directive down", () => {
    const out = applyBuilder(DEFAULT_CONTENT_SECURITY_POLICY, cfg({ directives: { 'media-src': { sources: ["'none'"], replace: false } } }))
    expect(directive(out, 'media-src')).toBe("media-src 'none'")
  })
})

describe('csp builder headers', () => {
  const builder = cfg({ mode: 'report-only', directives: { 'script-src': { sources: ['https://js.stripe.com'], replace: false } } })

  it('does nothing when off or empty', () => {
    expect(builderHeaders('default-src', cfg({ mode: 'off', directives: builder.directives }))).toEqual({ enforce: '', reportOnly: '', reportingEndpoints: '' })
    expect(builderHeaders('default-src', cfg({ mode: 'enforce' }))).toEqual({ enforce: '', reportOnly: '', reportingEndpoints: '' })
  })
  it('report-only leaves the enforced policy alone', () => {
    const h = securityHeaders(enabled, '/shop', builder)
    expect(h['Content-Security-Policy']).toBe(DEFAULT_CONTENT_SECURITY_POLICY)
    expect(h['Content-Security-Policy-Report-Only']).toContain('https://js.stripe.com')
    expect(h['Content-Security-Policy-Report-Only']).toContain('report-uri /api/csp-report')
    expect(h['Reporting-Endpoints']).toBe('csp-endpoint="/api/csp-report"')
  })
  it('enforce replaces the enforced policy and sends no report-only header', () => {
    const h = securityHeaders(enabled, '/shop', { ...builder, mode: 'enforce' })
    expect(h['Content-Security-Policy']).toContain('https://js.stripe.com')
    expect(h['Content-Security-Policy-Report-Only']).toBeUndefined()
  })
  it('can leave the report endpoint out', () => {
    const h = securityHeaders(enabled, '/shop', { ...builder, collectReports: false })
    expect(h['Content-Security-Policy-Report-Only']).not.toContain('report-uri')
    expect(h['Reporting-Endpoints']).toBeUndefined()
  })
  it('never touches the admin, and the free-text policy still merges first', () => {
    expect(securityHeaders(enabled, '/admin/pages', { ...builder, mode: 'enforce' })['Content-Security-Policy']).toBeUndefined()
    const custom = { ...enabled, headers: { ...enabled.headers, contentSecurityPolicy: 'img-src https://cdn.example.com' } }
    const h = securityHeaders(custom, '/', { ...builder, mode: 'enforce' })
    expect(directive(h['Content-Security-Policy'], 'img-src')).toContain('https://cdn.example.com')
    expect(directive(h['Content-Security-Policy'], 'script-src')).toContain('https://js.stripe.com')
  })
  it('is unchanged without a builder', () => {
    const h = securityHeaders(enabled, '/shop')
    expect(h['Content-Security-Policy']).toBe(DEFAULT_CONTENT_SECURITY_POLICY)
    expect(h['Content-Security-Policy-Report-Only']).toBeUndefined()
  })
})

describe('csp builder nonces and report-to', () => {
  it('makes a fresh url-safe-enough nonce each time', () => {
    const a = makeNonce()
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(makeNonce()).not.toBe(a)
  })
  it("swaps 'unsafe-inline' for the nonce and strict-dynamic in script-src only", () => {
    const out = applyNonce("default-src 'self'; script-src 'self' 'unsafe-inline' https://a.com; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests", 'AbC=')
    expect(directive(out, 'script-src')).toBe("script-src 'self' https://a.com 'nonce-AbC=' 'strict-dynamic'")
    expect(directive(out, 'style-src')).toBe("style-src 'self' 'unsafe-inline'")
    expect(out).toContain('upgrade-insecure-requests')
  })
  it('sends the nonce policy as report-only and declares the reporting endpoint', () => {
    const c = cfg({ mode: 'report-only', scriptNonce: true })
    const h = securityHeaders(enabled, '/shop', c, 'N0nce=')
    const ro = h['Content-Security-Policy-Report-Only']
    expect(directive(ro, 'script-src')).toContain("'nonce-N0nce='")
    expect(directive(ro, 'script-src')).not.toContain("'unsafe-inline'")
    expect(ro).toContain('report-to csp-endpoint')
    expect(h['Reporting-Endpoints']).toBe('csp-endpoint="/api/csp-report"')
    expect(h['Content-Security-Policy']).toBe(DEFAULT_CONTENT_SECURITY_POLICY)
  })
  it('does nothing for nonces without a nonce value, and never on the admin', () => {
    const c = cfg({ mode: 'enforce', scriptNonce: true })
    expect(securityHeaders(enabled, '/shop', c, '')['Content-Security-Policy']).toBe(DEFAULT_CONTENT_SECURITY_POLICY)
    expect(securityHeaders(enabled, '/admin/x', c, 'N=')['Content-Security-Policy']).toBeUndefined()
  })
  it('keeps the setting through normalise and warns about it', () => {
    expect(normaliseConfig({ scriptNonce: true }).scriptNonce).toBe(true)
    expect(normaliseConfig({}).scriptNonce).toBe(false)
    expect(builderWarnings(cfg({ scriptNonce: true })).join(' ')).toContain('Script nonces')
  })
})

describe('csp violation reports', () => {
  const legacy = { 'csp-report': { 'document-uri': 'https://site.test/shop?x=1', 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://js.stripe.com/v3/', disposition: 'report' } }
  it('reads the legacy report-uri format', () => {
    expect(parseReports(legacy)).toEqual([{ directive: 'script-src-elem', blocked: 'https://js.stripe.com', page: '/shop', disposition: 'report' }])
  })
  it('reads the Reporting API format', () => {
    const body = [{ type: 'csp-violation', body: { documentURL: 'https://site.test/', effectiveDirective: 'img-src', blockedURL: 'data:image/png;base64,AAA', disposition: 'enforce' } }, { type: 'network-error', body: {} }]
    expect(parseReports(body)).toEqual([{ directive: 'img-src', blocked: 'data:', page: '/', disposition: 'enforce' }])
  })
  it('ignores junk and caps the batch', () => {
    expect(parseReports('x')).toEqual([])
    expect(parseReports({ 'csp-report': { 'effective-directive': 'bad!directive' } })).toEqual([])
    expect(parseReports(Array.from({ length: 50 }, () => legacy))).toHaveLength(20)
  })
  it('reduces blocked URIs to something a policy can name', () => {
    expect(blockedSource('https://a.example.com:8443/x.js?y')).toBe('https://a.example.com:8443')
    expect(blockedSource('wss://live.example.com/s')).toBe('wss://live.example.com')
    expect(blockedSource('inline')).toBe('inline')
    expect(blockedSource('')).toBe('inline')
    expect(blockedSource('blob:https://site.test/uuid')).toBe('blob:')
  })
  it('filters browser-extension noise', () => {
    expect(isReportNoise({ directive: 'script-src', blocked: 'chrome-extension:', page: '/', disposition: 'enforce' })).toBe(true)
    expect(isReportNoise({ directive: 'script-src', blocked: 'https://a.com', page: '/', disposition: 'enforce' })).toBe(false)
  })
  it('suggests a one-click fix only when a source can fix it', () => {
    expect(directiveForViolation('script-src-elem')).toBe('script-src')
    expect(directiveForViolation('trusted-types')).toBeNull()
    expect(suggestionFor({ directive: 'script-src-elem', blocked: 'https://js.stripe.com' })).toEqual({ directive: 'script-src', source: 'https://js.stripe.com' })
    expect(suggestionFor({ directive: 'script-src', blocked: 'inline' })).toBeNull()
    expect(suggestionFor({ directive: 'script-src', blocked: 'eval' })).toBeNull()
  })
  it('adds a source once', () => {
    const once = addSource(EMPTY_CSP_BUILDER, 'script-src', 'https://a.com')
    expect(addSource(once, 'script-src', 'https://a.com')).toBe(once)
    expect(once.directives['script-src'].sources).toEqual(['https://a.com'])
  })
})
