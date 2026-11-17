import { describe, expect, it } from 'vitest'

import { CADENCES, isReportDue, parseRecipients, reportCsv, reportEmail, summaryLines, toCadence, toPreset, type ReportData } from '@/features/clientReports/core'
import { idsAddedAfterCopy, DEMO_EXPORT_OPTIONS, DEMO_IMPORT_SECTIONS, cleanBanner, demoPassword, describeBytes, isEmail, isResetDue, toResetEvery } from '@/features/demos/core'
import { cleanHost, cleanName, describeRollout, franchiseLocks, toLockChoice, toStatus } from '@/features/franchising/core'
import { CRON_JOBS } from '@/features/cron/registry'
import { JOB_RUNNERS } from '@/features/cron/jobs'
import { FEATURE_MAP } from '@/features/registry'

describe('agency demos (22g)', () => {
  it('lists only records added after the copy, by slug', () => {
    const docs = [{ id: 1, slug: 'home' }, { id: 2, slug: 'new-page' }, { id: 3 }, { id: 4, slug: '' }]
    expect(idsAddedAfterCopy(docs, new Set(['home']))).toEqual([2])
    expect(idsAddedAfterCopy(docs, new Set(['home', 'new-page']))).toEqual([])
  })
  const now = new Date('2027-03-17T12:00:00Z')
  it('never resets when the schedule is off', () => {
    expect(isResetDue('off', null, now)).toBe(false)
  })
  it('resets at once when a schedule is on and nothing ever ran', () => {
    expect(isResetDue('hourly', null, now)).toBe(true)
    expect(isResetDue('daily', 'not a date', now)).toBe(true)
  })
  it('waits a full period, with a few minutes of slack', () => {
    expect(isResetDue('hourly', '2027-03-17T11:30:00Z', now)).toBe(false)
    expect(isResetDue('hourly', '2027-03-17T11:02:00Z', now)).toBe(true)
    expect(isResetDue('daily', '2027-03-16T13:00:00Z', now)).toBe(false)
    expect(isResetDue('daily', '2027-03-16T11:59:00Z', now)).toBe(true)
  })
  it('keeps users, roles, customers and secrets out of the copy', () => {
    expect(DEMO_EXPORT_OPTIONS.users).toBe(false)
    expect(DEMO_EXPORT_OPTIONS.roles).toBe(false)
    expect(DEMO_EXPORT_OPTIONS.includeSecrets).toBe(false)
    expect(DEMO_EXPORT_OPTIONS.content.customers).toBe(false)
    expect(DEMO_IMPORT_SECTIONS).not.toContain('users')
    expect(DEMO_IMPORT_SECTIONS).not.toContain('roles')
  })
  it('cleans input', () => {
    expect(toResetEvery('weekly')).toBe('off')
    expect(toResetEvery('daily')).toBe('daily')
    expect(cleanBanner('a\nb  ')).toBe('a b')
    expect(cleanBanner('x'.repeat(500))).toHaveLength(200)
    expect(isEmail('a@b.co')).toBe(true)
    expect(isEmail('nope')).toBe(false)
    expect(describeBytes(2048)).toBe('2 KB')
  })
  it('makes a readable password', () => {
    const p = demoPassword()
    expect(p).toHaveLength(14)
    expect(p).toMatch(/^[A-Za-z2-9]+$/)
    expect(p).not.toMatch(/[Il1O0]/)
  })
})

describe('client reports (22f)', () => {
  const data: ReportData = {
    range: { from: '2027-03-01', to: '2027-03-30', days: 30 },
    currency: 'AUD',
    sales: { orders: 3, revenueCents: 12345, refundsCents: 345, netCents: 12000, customers: 2, newCustomers: 1, unitsSold: 5 },
    forms: { submissions: 7 },
    content: { pages: 4, posts: 2 },
  }
  it('parses recipients: valid, unique, at most ten', () => {
    expect(parseRecipients('A@b.co, a@b.co; bad, c@d.org')).toEqual(['a@b.co', 'c@d.org'])
    expect(parseRecipients(Array.from({ length: 20 }, (_, i) => `u${i}@x.com`).join(' '))).toHaveLength(10)
    expect(parseRecipients(5)).toEqual([])
  })
  it('works out when an email is due', () => {
    const now = new Date('2027-03-17T12:00:00Z')
    expect(isReportDue('none', null, now)).toBe(false)
    expect(isReportDue('weekly', null, now)).toBe(true)
    expect(isReportDue('weekly', '2027-03-12T12:00:00Z', now)).toBe(false)
    expect(isReportDue('weekly', '2027-03-10T12:00:00Z', now)).toBe(true)
    expect(isReportDue('monthly', '2027-02-20T12:00:00Z', now)).toBe(false)
    expect(isReportDue('monthly', '2027-02-10T12:00:00Z', now)).toBe(true)
  })
  it('falls back for unknown choices', () => {
    expect(toPreset('x')).toBe('30d')
    expect(toCadence('daily')).toBe('none')
    expect(CADENCES.map((c) => c.value)).toEqual(['none', 'weekly', 'monthly'])
  })
  it('summarises, leaving out sections that have no data', () => {
    expect(summaryLines(data).map((l) => l.label)).toContain('Net revenue')
    const bare = summaryLines({ ...data, sales: null, forms: null }).map((l) => l.label)
    expect(bare).not.toContain('Orders')
    expect(bare).not.toContain('Form entries')
    expect(reportCsv(data).split('\r\n')[0]).toBe('Measure,Value')
  })
  it('escapes the name in the email and omits an empty link', () => {
    const mail = reportEmail('<b>Acme</b>', data, '')
    expect(mail.html).not.toContain('<b>Acme</b>')
    expect(mail.html).toContain('&lt;b&gt;')
    expect(mail.html).not.toContain('Open the full report')
    expect(reportEmail('Acme', data, 'https://x.test/client-report/t').html).toContain('Open the full report')
  })
})

describe('franchising (22d)', () => {
  it('cleans names, hosts and choices', () => {
    expect(cleanName('  Bondi   Beach ')).toBe('Bondi Beach')
    expect(cleanHost('https://Bondi.Example.com/')).toEqual({ ok: true, host: 'bondi.example.com' })
    expect(cleanHost('localhost').ok).toBe(false)
    expect(cleanHost('*.example.com').ok).toBe(false)
    expect(toStatus('paused')).toBe('paused')
    expect(toStatus('x')).toBe('active')
    expect(toLockChoice('x')).toBe('structure')
    expect(toLockChoice('full')).toBe('full')
  })
  it('builds the lock on a rolled-out page and keeps the template section locks', () => {
    const template = { nodes: { abc: { mode: 'full', unlockRoles: [] as string[], editableProps: [] as string[] } } }
    const fixed = franchiseLocks(template, 'structure') as { document: { mode: string; unlockRoles: string[]; editableProps: string[] }; nodes: Record<string, unknown> }
    expect(fixed.document.mode).toBe('structure')
    expect(fixed.document.unlockRoles).toEqual([])
    expect(fixed.document.editableProps).toContain('heading')
    expect(Object.keys(fixed.nodes)).toEqual(['abc'])
    const full = franchiseLocks(null, 'full') as { document: { mode: string; editableProps: string[] } }
    expect(full.document).toMatchObject({ mode: 'full', editableProps: [] })
    expect((franchiseLocks(template, 'none') as { document?: unknown }).document).toBeUndefined()
  })
  it('reports a rollout in words', () => {
    expect(describeRollout({ created: 0, updated: 0, failed: 0, franchises: 0, messages: [] })).toContain('no active franchises')
    expect(describeRollout({ created: 2, updated: 1, failed: 1, franchises: 3, messages: ['Bondi: oops'] })).toBe('Rolled out to 3 franchise(s): 2 page(s) created, 1 updated, 1 failed. Bondi: oops')
  })
})

describe('wiring', () => {
  it('registers the features off by default with their tables', () => {
    for (const key of ['demos', 'clientreports', 'franchising'] as const) {
      expect(FEATURE_MAP[key].defaultEnabled).toBe(false)
      expect(FEATURE_MAP[key].tables.length).toBeGreaterThan(0)
    }
  })
  it('has a runner for each new cron job', () => {
    for (const name of ['demo-reset', 'client-reports']) {
      expect(CRON_JOBS.some((j) => j.name === name)).toBe(true)
      expect(typeof JOB_RUNNERS[name]).toBe('function')
    }
  })
})
