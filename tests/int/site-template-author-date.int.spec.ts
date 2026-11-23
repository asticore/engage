// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { matchesLocation, dateRuleMatches, isDateRuleValue } from '@/features/customFields/location'
import { postAuthorKeys } from '@/features/siteTemplates/archiveQueries'
import { sanitizeConditions } from '@/features/siteTemplates/conditions'
import { CONDITION_KINDS, summariseConditions, validateConditions } from '@/features/siteTemplates/conditionsSummary'
import { pickSiteTemplate } from '@/features/siteTemplates/pick'
import type { SiteTemplate } from '@/features/siteTemplates/types'

const NOW = Date.parse('2026-11-23T12:00:00Z')
const DAY = 86_400_000
const author = (value: string) => [{ param: 'author' as const, operator: 'equals' as const, value }]
const date = (value: string, operator: 'equals' | 'notEquals' = 'equals') => [{ param: 'date' as const, operator, value }]

describe('author and date condition kinds', () => {
  it('are offered in the editor and accepted by the sanitiser', () => {
    const params = CONDITION_KINDS.map((k) => k.param)
    expect(params).toEqual(expect.arrayContaining(['author', 'date']))
    expect(sanitizeConditions([author('bob')]).valid).toBe(true)
    expect(sanitizeConditions([date('before:2026-01-01')]).valid).toBe(true)
    expect(sanitizeConditions([date('after:2026-01-01')]).valid).toBe(true)
    expect(sanitizeConditions([date('within:30')]).valid).toBe(true)
  })

  it('reject malformed or impossible date values (fail closed)', () => {
    for (const bad of ['', 'soon', 'before:2026-1-1', 'before:2026-02-30', 'after:2026-13-01', 'within:0', 'within:3651', 'within:-3', ' before:2026-01-01']) {
      expect(sanitizeConditions([date(bad)]).valid, bad).toBe(false)
      expect(validateConditions([date(bad)]), bad).toMatch(/invalid/)
    }
  })

  it('validates the date value shape on its own', () => {
    expect(isDateRuleValue('before:2024-02-29')).toBe(true)
    expect(isDateRuleValue('before:2026-02-29')).toBe(false)
    expect(isDateRuleValue('within:3650')).toBe(true)
  })
})

describe('author matching', () => {
  it('matches the slug, the display name or the id, case-insensitively', () => {
    const ctx = { postAuthors: ['7', 'bob-smith', 'Bob Smith'] }
    expect(matchesLocation([author('bob-smith')], ctx)).toBe(true)
    expect(matchesLocation([author('BOB-SMITH')], ctx)).toBe(true)
    expect(matchesLocation([author('Bob Smith')], ctx)).toBe(true)
    expect(matchesLocation([author('7')], ctx)).toBe(true)
    expect(matchesLocation([author('alice')], ctx)).toBe(false)
  })

  it('does not match when the post has no author, and never on pages without a post', () => {
    expect(matchesLocation([author('bob')], { postAuthors: [] })).toBe(false)
    expect(matchesLocation([author('bob')], { postAuthors: null })).toBe(false)
    expect(matchesLocation([author('bob')], {})).toBe(false)
    expect(matchesLocation([[{ param: 'author', operator: 'notEquals', value: 'bob' }]], {})).toBe(false)
  })

  it('an exclude rule hides the author and shows everyone else', () => {
    const groups = [[{ param: 'author' as const, operator: 'notEquals' as const, value: 'bob' }]]
    expect(matchesLocation(groups, { postAuthors: ['alice'] })).toBe(true)
    expect(matchesLocation(groups, { postAuthors: ['bob'] })).toBe(false)
  })

  it('builds the keys from a populated or bare author', () => {
    expect(postAuthorKeys({ author: { id: 7, slug: 'bob', displayName: 'Bob' } })).toEqual(['7', 'bob', 'Bob'])
    expect(postAuthorKeys({ author: 7 })).toEqual(['7'])
    expect(postAuthorKeys({ author: null })).toEqual([])
    expect(postAuthorKeys({})).toEqual([])
  })
})

describe('date matching', () => {
  it('before and after compare with the start of the day (UTC)', () => {
    expect(dateRuleMatches('before:2026-01-01', '2025-12-31T23:59:00Z', NOW)).toBe(true)
    expect(dateRuleMatches('before:2026-01-01', '2026-01-01T00:00:00Z', NOW)).toBe(false)
    expect(dateRuleMatches('after:2026-01-01', '2026-01-01T00:00:00Z', NOW)).toBe(true)
    expect(dateRuleMatches('after:2026-01-01', '2025-12-31T23:59:59Z', NOW)).toBe(false)
  })

  it('within N days looks back from now', () => {
    expect(dateRuleMatches('within:30', new Date(NOW - 29 * DAY).toISOString(), NOW)).toBe(true)
    expect(dateRuleMatches('within:30', new Date(NOW - 31 * DAY).toISOString(), NOW)).toBe(false)
    expect(dateRuleMatches('within:1', new Date(NOW + DAY).toISOString(), NOW)).toBe(false)
  })

  it('no date never matches, and a rule not on a post never matches', () => {
    expect(dateRuleMatches('within:30', null, NOW)).toBe(false)
    expect(dateRuleMatches('before:2030-01-01', 'not a date', NOW)).toBe(false)
    expect(matchesLocation([date('before:2030-01-01')], { postDate: null }, { now: NOW })).toBe(false)
    expect(matchesLocation([date('before:2030-01-01')], {}, { now: NOW })).toBe(false)
    expect(matchesLocation([date('before:2030-01-01', 'notEquals')], { postDate: '2026-01-01T00:00:00Z' }, { now: NOW })).toBe(false)
  })

  it('uses the match options time through matchesLocation', () => {
    const ctx = { postDate: new Date(NOW - 10 * DAY).toISOString() }
    expect(matchesLocation([date('within:14')], ctx, { now: NOW })).toBe(true)
    expect(matchesLocation([date('within:5')], ctx, { now: NOW })).toBe(false)
  })
})

describe('summaries and picking', () => {
  it('describes the new rules in plain words', () => {
    expect(summariseConditions([author('bob')])).toBe('When post author is "bob".')
    expect(summariseConditions([date('before:2026-01-01')])).toBe('When post date is before 2026-01-01.')
    expect(summariseConditions([date('within:30', 'notEquals')])).toBe('When post date is not within the last 30 days.')
  })

  it('a template limited to an author beats the general one for that post', () => {
    const general: SiteTemplate = { id: 1, kind: 'single-post', conditions: null, blocks: [{}] }
    const byAuthor: SiteTemplate = { id: 2, kind: 'single-post', conditions: [author('bob')], blocks: [{}] }
    const ctx = { postAuthors: ['bob'] }
    expect(pickSiteTemplate([general, byAuthor], 'single-post', ctx)?.id).toBe(2)
    expect(pickSiteTemplate([general, byAuthor], 'single-post', { postAuthors: ['alice'] })?.id).toBe(1)
  })

  it('a template limited to recent posts only applies to recent posts', () => {
    const recent: SiteTemplate = { id: 3, kind: 'single-post', conditions: [date('within:7')], blocks: [{}] }
    const fresh = new Date().toISOString()
    expect(pickSiteTemplate([recent], 'single-post', { postDate: fresh })?.id).toBe(3)
    expect(pickSiteTemplate([recent], 'single-post', { postDate: '2001-01-01T00:00:00Z' })).toBeNull()
  })
})
