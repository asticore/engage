import { deflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { buildPdf } from '@/features/apiBuilder/pdf'
import { parseLogo } from '@/features/clientReports/logo'

import { CADENCES, isReportDue, parseRecipients, parseSections, reportCsv, reportEmail, reportPdfLines, reportTables, summaryLines, toCadence, toDay, toPreset, wantsSection, withViewerRange, type ReportData } from '@/features/clientReports/core'
import { copyKey, picturesAddedAfterCopy, idsAddedAfterCopy, DEMO_EXPORT_OPTIONS, DEMO_IMPORT_SECTIONS, cleanBanner, demoPassword, describeBytes, isEmail, isResetDue, toResetEvery } from '@/features/demos/core'
import { cleanHost, cleanName, describeRollout, franchiseLocks, toLockChoice, toStatus } from '@/features/franchising/core'
import { assetFilePath, collectRefs, pageFilePath, rewriteRefs, rootPrefix, sitemapPaths, stripScripts } from '@/features/demos/staticExport'
import { CRON_JOBS } from '@/features/cron/registry'
import { JOB_RUNNERS } from '@/features/cron/jobs'
import { FEATURE_MAP } from '@/features/registry'

describe('static export (17g)', () => {
  const origin = 'https://demo.test'
  const html = '<html><head><link rel="stylesheet" href="/styles.css"><script src="/_next/a.js"></script></head><body><a href="/about#x">About</a><a href="https://other.test/">Out</a><img src="/api/media/file/a.jpg" srcset="/a.jpg 1x, /a2.jpg 2x"></body></html>'
  it('names pages and assets', () => {
    expect(pageFilePath('/')).toBe('index.html')
    expect(pageFilePath('/shop/hats/')).toBe('shop/hats/index.html')
    expect(assetFilePath('/a/b.css', '')).toBe('assets/a/b.css')
    expect(assetFilePath('/_next/image', '?url=x&w=64', 'image/webp')).toMatch(/^assets\/_next\/image-[a-z0-9]+\.webp$/)
    expect(rootPrefix('shop/hats/index.html')).toBe('../../')
  })
  it('finds same-site references only', () => {
    expect(collectRefs(html, origin, 'html').sort()).toEqual(['/_next/a.js', '/a.jpg', '/a2.jpg', '/about', '/api/media/file/a.jpg', '/styles.css'])
    expect(collectRefs('a{background:url("/f.woff2")} b{background:url(data:x)}', origin, 'css')).toEqual(['/f.woff2'])
  })
  it('strips scripts and rewrites links relative', () => {
    const clean = stripScripts(html)
    expect(clean).not.toContain('<script')
    const map = { pages: new Map([['/about', 'about/index.html']]), assets: new Map([['/styles.css', 'assets/styles.css'], ['/a.jpg', 'assets/a.jpg']]) }
    const out = rewriteRefs(clean, origin, 'shop/index.html', map, 'html')
    expect(out).toContain('href="../assets/styles.css"')
    expect(out).toContain('href="../about/index.html#x"')
    expect(out).toContain('href="https://other.test/"')
    expect(out).toContain('../assets/a.jpg 1x, /a2.jpg 2x')
  })
  it('reads page paths from a sitemap', () => {
    expect(sitemapPaths('<urlset><url><loc>https://demo.test/</loc></url><url><loc>https://demo.test/a</loc></url><url><loc>https://x.test/b</loc></url></urlset>', origin)).toEqual(['/', '/a'])
  })
})

describe('agency demos (22g)', () => {
  it('keeps picture copies under their own prefix and finds pictures added later', () => {
    expect(copyKey('a.jpg')).toBe('demo-copy/a.jpg')
    expect(picturesAddedAfterCopy([{ filename: 'a.jpg' }, { filename: 'b.jpg' }, {}], new Set(['a.jpg']))).toEqual([{ filename: 'b.jpg' }])
  })
  it('lists only records added after the copy, by slug', () => {
    const docs = [{ id: 1, slug: 'home' }, { id: 2, slug: 'new-page' }, { id: 3 }, { id: 4, slug: '' }]
    expect(idsAddedAfterCopy(docs, new Set(['home']))).toEqual([2])
    expect(idsAddedAfterCopy(docs, new Set(['home', 'new-page']))).toEqual([])
  })
  it('every starter can start a demo', async () => {
    const { STARTERS, getStarter } = await import('@/features/siteTemplates/starters')
    for (const s of STARTERS) {
      expect(getStarter(s.id)?.blocks().length).toBeGreaterThan(0)
    }
    expect(getStarter('nope')).toBeUndefined()
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

describe('client reports sections, dates and Google numbers (17f)', () => {
  const base: ReportData = { range: { from: '2027-03-01', to: '2027-03-30', days: 30 }, currency: 'AUD', sales: null, forms: null, content: null }
  it('parses sections and treats none as all', () => {
    expect(parseSections('traffic, bogus, search, traffic')).toEqual(['traffic', 'search'])
    expect(parseSections(5)).toEqual([])
    expect(wantsSection([], 'sales')).toBe(true)
    expect(wantsSection(['traffic'], 'sales')).toBe(false)
  })
  it('accepts only real calendar days and lets a viewer pick dates', () => {
    expect(toDay('2027-02-30')).toBe('')
    expect(toDay('2027-03-01')).toBe('2027-03-01')
    const spec = { preset: '30d' as const, rangeFrom: '', rangeTo: '' }
    expect(withViewerRange(spec, '2027-03-05', '2027-03-01')).toBe(spec)
    expect(withViewerRange(spec, '2027-03-01', '2027-03-05')).toEqual({ preset: 'custom', rangeFrom: '2027-03-01', rangeTo: '2027-03-05' })
    expect(toPreset('custom')).toBe('custom')
  })
  it('shows traffic and search lines and tables, or why they are missing', () => {
    const d: ReportData = {
      ...base,
      traffic: { state: 'ok', data: { users: 10, sessions: 14, topPages: [{ path: '/a', views: 9 }], channels: [{ channel: 'Organic Search', sessions: 8 }] } },
      search: { state: 'ok', data: { clicks: 5, impressions: 100, ctr: 0.05, position: 7.2, topQueries: [{ key: 'shoes', clicks: 3, impressions: 40 }], topPages: [] } },
    }
    const labels = summaryLines(d).map((l) => l.label)
    expect(labels).toEqual(expect.arrayContaining(['Visitors', 'Search clicks', 'Click-through rate']))
    expect(reportTables(d).map((t) => t.title)).toEqual(['Top pages by views', 'Where visitors came from', 'Top search queries'])
    expect(reportCsv(d)).toContain('shoes')
    const off = summaryLines({ ...base, traffic: { state: 'unavailable', message: 'Google is not connected on this site.' } })
    expect(off.find((l) => l.label === 'Website traffic')?.value).toContain('not connected')
    expect(reportEmail('A', d, '', 'https://x.test/logo.png').html).toContain('<img src="https://x.test/logo.png"')
    expect(reportEmail('A', d, '', 'javascript:x').html).not.toContain('<img')
  })
})

describe('client report PDF and logo (17f)', () => {
  const crc = new Uint8Array(4)
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length)
    new DataView(out.buffer).setUint32(0, data.length)
    out.set(new TextEncoder().encode(type), 4)
    out.set(data, 8)
    out.set(crc, 8 + data.length)
    return out
  }
  const png = (width: number, height: number, colour: number, interlace = 0): Uint8Array => {
    const ihdr = new Uint8Array(13)
    const dv = new DataView(ihdr.buffer)
    dv.setUint32(0, width)
    dv.setUint32(4, height)
    ihdr[8] = 8
    ihdr[9] = colour
    ihdr[12] = interlace
    const channels = colour === 0 ? 1 : 3
    const raw = new Uint8Array(height * (1 + width * channels))
    const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const p of parts) {
      out.set(p, at)
      at += p.length
    }
    return out
  }
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 20, 0, 40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9, 0, 0, 0, 0])
  it('reads a plain PNG and a baseline JPEG, and refuses what it cannot draw', () => {
    expect(parseLogo(png(40, 20, 2))).toMatchObject({ width: 40, height: 20, components: 3, filter: 'FlateDecode' })
    expect(parseLogo(png(10, 10, 0))).toMatchObject({ components: 1 })
    expect(parseLogo(png(10, 10, 6))).toBeNull()
    expect(parseLogo(png(10, 10, 2, 1))).toBeNull()
    expect(parseLogo(jpeg)).toMatchObject({ width: 40, height: 20, components: 3, filter: 'DCTDecode' })
    expect(parseLogo(new Uint8Array(100))).toBeNull()
  })
  it('writes a PDF with the report lines, with and without a logo', () => {
    const data: ReportData = { range: { from: '2027-03-01', to: '2027-03-30', days: 30 }, currency: 'AUD', sales: null, forms: { submissions: 7 }, content: null }
    const lines = reportPdfLines('Acme', data)
    const plain = new TextDecoder('latin1').decode(buildPdf(lines, 'Acme'))
    expect(plain.startsWith('%PDF-1.4')).toBe(true)
    expect(plain).toContain('Form entries: 7')
    expect(plain).not.toContain('/Im1')
    const withLogo = new TextDecoder('latin1').decode(buildPdf(lines, 'Acme', parseLogo(png(40, 20, 2))))
    expect(withLogo).toContain('/Subtype /Image')
    expect(withLogo).toContain('/Predictor 15')
    expect(withLogo).toContain('/Im1 Do')
    expect(withLogo).toContain('Form entries: 7')
  })
  it('adds a PDF link to the email', () => {
    const data: ReportData = { range: { from: '2027-03-01', to: '2027-03-30', days: 30 }, currency: 'AUD', sales: null, forms: null, content: null }
    expect(reportEmail('A', data, 'https://x.test/r', '', 'https://x.test/r.pdf').html).toContain('Download as PDF')
    expect(reportEmail('A', data, 'https://x.test/r').html).not.toContain('Download as PDF')
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
