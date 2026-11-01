import { describe, expect, it } from 'vitest'

import { DEFAULT_CONTENT_SECURITY_POLICY } from '@/features/security/headers'
import { mergeCustomPolicy, validateCustomPolicy, validateCustomPolicyField } from '@/features/security/customPolicy'
import { DOMAIN_SENSITIVE_FIELDS, SECURITY_SENSITIVE_FIELDS, sensitiveChanges } from '@/features/security/sensitiveChanges'
import { analyticsIdProblems } from '@/features/integrations/analyticsIds'
import { checkAiKeys, checkCloudflareZone } from '@/features/integrations/remoteChecks'
import { assertGlobalNotChanged, ConflictError } from '@/localapi/operations'

const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? ''

describe('custom Content-Security-Policy: merge with the default', () => {
  it('adds custom sources to the default directive instead of replacing it', () => {
    const merged = mergeCustomPolicy(DEFAULT_CONTENT_SECURITY_POLICY, "img-src https://cdn.example.com; script-src https://widget.example.com")
    expect(directive(merged, 'img-src')).toContain("'self'")
    expect(directive(merged, 'img-src')).toContain('https://cdn.example.com')
    expect(directive(merged, 'script-src')).toContain('https://www.googletagmanager.com')
    expect(directive(merged, 'script-src')).toContain('https://widget.example.com')
    expect(directive(merged, 'font-src')).toContain('https://fonts.gstatic.com')
  })

  it('adds a directive the default does not have, and keeps valueless directives', () => {
    const merged = mergeCustomPolicy(DEFAULT_CONTENT_SECURITY_POLICY, 'worker-src blob:')
    expect(directive(merged, 'worker-src')).toBe('worker-src blob:')
    expect(merged).toContain('upgrade-insecure-requests')
  })

  it("lets a directive set to 'none' replace the default for that directive", () => {
    const merged = mergeCustomPolicy(DEFAULT_CONTENT_SECURITY_POLICY, "frame-src 'none'")
    expect(directive(merged, 'frame-src')).toBe("frame-src 'none'")
  })

  it('does not duplicate a source the default already allows', () => {
    const merged = mergeCustomPolicy(DEFAULT_CONTENT_SECURITY_POLICY, "img-src 'self' data:")
    expect(directive(merged, 'img-src').split(' ').filter((t) => t === "'self'")).toHaveLength(1)
  })
})

describe('custom Content-Security-Policy: validation', () => {
  it('accepts a blank policy and a sensible one', () => {
    expect(validateCustomPolicy('')).toBeNull()
    expect(validateCustomPolicy("default-src 'self'; script-src 'self' https://js.example.com; img-src https: data:\nfont-src https://fonts.gstatic.com")).toBeNull()
    expect(validateCustomPolicy("script-src 'nonce-abc123' 'strict-dynamic'")).toBeNull()
  })

  it('names an unknown directive so the admin can fix the spelling', () => {
    expect(validateCustomPolicy("scrpt-src 'self'")).toContain('"scrpt-src"')
  })

  it('refuses a source that cannot be a keyword, scheme or host', () => {
    expect(validateCustomPolicy("script-src 'selff'")).toContain('In script-src')
    expect(validateCustomPolicy('img-src https://cdn.example.com,https://b.example.com')).toContain('commas')
    expect(validateCustomPolicy('img-src "quoted"')).not.toBeNull()
  })

  it('refuses sources after a valueless directive', () => {
    expect(validateCustomPolicy('upgrade-insecure-requests https:')).toContain('takes no sources')
  })

  it('returns true for the form, or the message', () => {
    expect(validateCustomPolicyField('default-src self')).toBe(true)
    expect(validateCustomPolicyField("bogus-src 'self'")).toContain('bogus-src')
    expect(validateCustomPolicyField(undefined)).toBe(true)
  })
})

describe('analytics ID format check', () => {
  it('passes blank and well-formed IDs', () => {
    expect(analyticsIdProblems({})).toEqual([])
    expect(
      analyticsIdProblems({ ga4MeasurementId: 'G-ABC123XYZ9', gtmContainerId: 'GTM-ABC123', clarityProjectId: 'abcd1234ef', metaPixelId: '1234567890123456', tiktokPixelId: 'C5ABCDEFGHIJKLMNOP' }),
    ).toEqual([])
  })

  it('flags a GA4 ID with the wrong prefix and a Meta ID with letters', () => {
    const problems = analyticsIdProblems({ ga4MeasurementId: 'UA-12345-1', metaPixelId: '12ab' })
    expect(problems.map((p) => p.field)).toEqual(['ga4MeasurementId', 'metaPixelId'])
  })
})

describe('sensitive settings changes', () => {
  it('reports only the watched fields that changed, with before and after', () => {
    const before = { adminPath: '/admin', requireTwoFactorForAdmins: false, unrelated: 'a' }
    const after = { adminPath: '/studio', requireTwoFactorForAdmins: false, unrelated: 'b' }
    const changes = sensitiveChanges(SECURITY_SENSITIVE_FIELDS, before, after)
    expect(changes).toEqual([{ label: 'Admin URL', before: '"/admin"', after: '"/studio"' }])
  })

  it('treats a missing value and null as the same', () => {
    expect(sensitiveChanges(SECURITY_SENSITIVE_FIELDS, { adminPath: null }, {})).toEqual([])
  })

  it('ignores row ids and timestamps in the domain list, but catches an admin-access change', () => {
    const before = { domains: [{ id: 1, host: 'a.example', allowAdmin: false, updatedAt: 'x' }] }
    const same = { domains: [{ id: 9, host: 'a.example', allowAdmin: false, updatedAt: 'y' }] }
    const flipped = { domains: [{ id: 1, host: 'a.example', allowAdmin: true }] }
    expect(sensitiveChanges(DOMAIN_SENSITIVE_FIELDS, before, same)).toEqual([])
    expect(sensitiveChanges(DOMAIN_SENSITIVE_FIELDS, before, flipped)).toHaveLength(1)
  })
})

describe('global save conflict check', () => {
  it('passes when no expectation is sent or the version matches', () => {
    expect(() => assertGlobalNotChanged('2026-11-01T10:00:00.000Z', null)).not.toThrow()
    expect(() => assertGlobalNotChanged('2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z')).not.toThrow()
  })

  it('refuses a stale version with ConflictError', () => {
    expect(() => assertGlobalNotChanged('2026-11-01T10:05:00.000Z', '2026-11-01T10:00:00.000Z')).toThrow(ConflictError)
  })
})

describe('read-only connection checks', () => {
  const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 })
  const refused = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

  it('says so when no AI key is saved, without calling the provider', async () => {
    const calls: string[] = []
    const result = await checkAiKeys({ claude: '', openai: null }, async (url) => {
      calls.push(url)
      return ok()
    })
    expect(calls).toEqual([])
    expect(result.claude.ok).toBe(false)
    expect(result.openai.message).toContain('No OpenAI key')
  })

  it('reports each AI key separately and never echoes the key', async () => {
    const result = await checkAiKeys({ claude: 'sk-ant-secret', openai: 'sk-openai-secret' }, async (url) => {
      if (url.includes('anthropic')) return refused(401, { error: { message: 'invalid x-api-key' } })
      return ok()
    })
    expect(result.claude).toEqual({ ok: false, message: 'Anthropic refused this key (HTTP 401) (invalid x-api-key).' })
    expect(result.openai.ok).toBe(true)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('checks the Cloudflare zone and names it on success', async () => {
    const zone = 'a'.repeat(32)
    const result = await checkCloudflareZone({ zoneId: zone, apiToken: 'tok' }, async () => ok({ success: true, result: { name: 'example.com' } }))
    expect(result).toEqual({ ok: true, message: 'Connected to the zone example.com.' })
  })

  it('does not call Cloudflare for a malformed zone ID', async () => {
    const result = await checkCloudflareZone({ zoneId: 'nope', apiToken: 'tok' }, async () => {
      throw new Error('should not be called')
    })
    expect(result.ok).toBe(false)
  })
})
