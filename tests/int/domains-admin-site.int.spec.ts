// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { attachConfigured, attachSettingsFrom, attachWorkerDomain } from '@/features/domains/cloudflareAttach'
import { ALL_SITES, effectiveSite, isChoiceAllowed, visibleSitesFor, type RegisteredSite } from '@/features/domains/adminSite'

const registry: RegisteredSite[] = [
  { host: 'example.com', label: 'Global', status: 'active', isPrimary: true },
  { host: 'example.com.au', label: 'Australia', status: 'active', isPrimary: false },
  { host: 'example.co.uk', label: 'UK', status: 'disabled', isPrimary: false },
]
const admin = { roles: ['admin'] }
const editor = { roles: ['editor'] }
const limited = { roles: ['editor'], allowedDomains: ',example.com.au,' }

describe('admin site switcher rules', () => {
  it('offers every active site to an unrestricted account, and All sites with it', () => {
    const visible = visibleSitesFor(admin, registry)
    expect(visible.sites.map((s) => s.host)).toEqual(['example.com', 'example.com.au'])
    expect(visible.unrestricted).toBe(true)
    expect(visible.primary).toBe('example.com')
    expect(visibleSitesFor(editor, registry).unrestricted).toBe(true)
  })

  it('offers only the allowed sites to a limited account, and no All sites option', () => {
    const visible = visibleSitesFor(limited, registry)
    expect(visible.sites.map((s) => s.host)).toEqual(['example.com.au'])
    expect(visible.unrestricted).toBe(false)
    expect(visible.primary).toBe('example.com.au')
  })

  it('defaults to the primary site, and All sites only means no filter for an unrestricted account', () => {
    const visible = visibleSitesFor(admin, registry)
    expect(effectiveSite(null, visible)).toBe('example.com')
    expect(effectiveSite('example.com.au', visible)).toBe('example.com.au')
    expect(effectiveSite(ALL_SITES, visible)).toBeNull()
  })

  it('never lets a limited account reach a site outside its list, even with a stored choice', () => {
    const visible = visibleSitesFor(limited, registry)
    expect(effectiveSite('example.com', visible)).toBe('example.com.au')
    expect(effectiveSite(ALL_SITES, visible)).toBe('example.com.au')
    expect(isChoiceAllowed('example.com', visible)).toBe(false)
    expect(isChoiceAllowed(ALL_SITES, visible)).toBe(false)
    expect(isChoiceAllowed('example.com.au', visible)).toBe(true)
  })

  it('refuses a disabled or unregistered site as a choice', () => {
    const visible = visibleSitesFor(admin, registry)
    expect(isChoiceAllowed('example.co.uk', visible)).toBe(false)
    expect(isChoiceAllowed('elsewhere.test', visible)).toBe(false)
    expect(isChoiceAllowed(ALL_SITES, visible)).toBe(true)
  })

  it('gives no site filter when nothing is registered', () => {
    expect(effectiveSite(null, visibleSitesFor(admin, []))).toBeNull()
  })
})

describe('Connect domain (Cloudflare Workers custom domains)', () => {
  const full = { cloudflare: { accountId: 'acc', workerName: 'site', zoneId: 'zone', apiToken: 'tok' } }

  it('needs the account, Worker name, zone and token all saved', () => {
    expect(attachSettingsFrom(full)).toEqual({ accountId: 'acc', workerName: 'site', zoneId: 'zone', apiToken: 'tok' })
    expect(attachConfigured({ cloudflare: { ...full.cloudflare, workerName: '' } })).toBe(false)
    expect(attachConfigured(null)).toBe(false)
  })

  it('sends the host to the Workers domains endpoint with the bearer token', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }
    const result = await attachWorkerDomain('example.com.au', attachSettingsFrom(full)!, fetcher)
    expect(result.ok).toBe(true)
    expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/workers/domains')
    expect(calls[0].init?.method).toBe('PUT')
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      hostname: 'example.com.au',
      zone_id: 'zone',
      service: 'site',
      environment: 'production',
    })
  })

  it('reports the API message on failure and never includes the token', async () => {
    const fetcher = async () => new Response(JSON.stringify({ success: false, errors: [{ message: 'Zone not found' }] }), { status: 403 })
    const result = await attachWorkerDomain('example.com.au', attachSettingsFrom(full)!, fetcher)
    expect(result).toEqual({ ok: false, reason: 'failed', message: 'Zone not found (HTTP 403)' })
    expect(JSON.stringify(result)).not.toContain('tok')
  })
})

describe('one-time scope rewrite (20270220_110000_domain_scoped_content)', () => {
  it('turns old plain lists into the delimited form, once', async () => {
    const { normaliseScope } = await import('@/migrations/20270220_110000_domain_scoped_content')
    expect(normaliseScope('example.com, Example.com.au')).toBe(',example.com,example.com.au,')
    expect(normaliseScope(',example.com,')).toBe(',example.com,')
    expect(normaliseScope('https://example.com/shop')).toBe(',example.com,')
    expect(normaliseScope('  ')).toBeNull()
    expect(normaliseScope(null)).toBeNull()
  })
})

describe('menu link to a page scoped to another domain', () => {
  it('points at the page on its own domain, and stays hidden on the domain it is not on', async () => {
    const { menuPageOtherDomain } = await import('@/features/domains/menu')
    const entries = [{ page: { id: 7, availableDomains: ',example.com.au,', isHomepage: false }, path: ['about'] }]
    expect(menuPageOtherDomain(7, 'example.com', entries)).toEqual({ host: 'example.com.au', path: '/about' })
    expect(menuPageOtherDomain(7, 'example.com.au', entries)).toBeNull()
    expect(menuPageOtherDomain(8, 'example.com', entries)).toBeNull()
    expect(menuPageOtherDomain(7, null, entries)).toBeNull()
  })
})
