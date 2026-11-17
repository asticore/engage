import { describe, expect, it } from 'vitest'

import { matchRateRule, parseRateRule, type RateRule } from '@/features/security/routeRules'

const rule = (id: number, pathPrefix: string, method = 'ANY', enabled = true): RateRule => ({ id, pathPrefix, method, limit: 5, windowSeconds: 60, note: '', enabled })

describe('rate rules', () => {
  it('validates input', () => {
    expect(parseRateRule({ pathPrefix: 'api', limit: 5, windowSeconds: 60 }).ok).toBe(false)
    expect(parseRateRule({ pathPrefix: '/api', limit: 0, windowSeconds: 60 }).ok).toBe(false)
    expect(parseRateRule({ pathPrefix: '/api', limit: 5, windowSeconds: 5 }).ok).toBe(false)
    expect(parseRateRule({ pathPrefix: '/api', method: 'TRACE', limit: 5, windowSeconds: 60 }).ok).toBe(false)
    expect(parseRateRule({ pathPrefix: '/api/forms', method: 'post', limit: '10', windowSeconds: '30' })).toMatchObject({ ok: true, rule: { method: 'POST', limit: 10, windowSeconds: 30 } })
  })
  it('matches the most specific enabled rule', () => {
    const rules = [rule(1, '/api'), rule(2, '/api/forms'), rule(3, '/api/forms/contact', 'POST', false)]
    expect(matchRateRule(rules, '/api/forms/contact', 'POST')?.id).toBe(2)
    expect(matchRateRule(rules, '/api/other', 'GET')?.id).toBe(1)
    expect(matchRateRule(rules, '/apiary', 'GET')).toBeNull()
    expect(matchRateRule([rule(4, '/search', 'GET')], '/search', 'POST')).toBeNull()
  })
})
