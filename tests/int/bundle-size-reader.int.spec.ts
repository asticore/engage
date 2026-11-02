// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { checkBudget, formatReport, measureRoutes, readRouteChunks, runBundleSize } from '../../scripts/bundle-size.mjs'

const fixture = path.join(process.cwd(), 'tests/fixtures/bundle-size')
const nextDir = path.join(fixture, 'next-build')
const budgetFile = path.join(fixture, 'budget.json')
const fileBytes = (rel: string) => fs.readFileSync(path.join(nextDir, rel))
const gzipOf = (rel: string) => gzipSync(fileBytes(rel), { level: 9 }).length

describe('bundle size reader', () => {
  it('reads the route map from app-build-manifest.json and falls back to build-manifest.json', () => {
    const app = readRouteChunks(nextDir)
    expect(app?.source).toBe('app-build-manifest.json')
    expect(Object.keys(app?.routes ?? {})).toEqual(['/(frontend)/page', '/(frontend)/shop/page', '/_not-found/page'])

    const old = path.join(fixture, 'legacy-build')
    fs.mkdirSync(old, { recursive: true })
    fs.writeFileSync(path.join(old, 'build-manifest.json'), JSON.stringify({ pages: { '/_app': ['static/chunks/shared.js'] } }))
    try {
      expect(readRouteChunks(old)).toEqual({ source: 'build-manifest.json', routes: { '/_app': ['static/chunks/shared.js'] } })
    } finally {
      fs.rmSync(old, { recursive: true, force: true })
    }
    expect(readRouteChunks(path.join(fixture, 'no-such-dir'))).toBeNull()
  })

  it('counts each chunk once per route, skips CSS, and lists files the disk does not have', () => {
    const { measured, missing } = measureRoutes(nextDir, readRouteChunks(nextDir)!.routes)
    const home = measured.find((r) => r.route === '/(frontend)/page')!
    expect(home.files).toBe(2)
    expect(home.rawBytes).toBe(fileBytes('static/chunks/shared.js').length + fileBytes('static/chunks/page-a.js').length)
    expect(home.gzipBytes).toBe(gzipOf('static/chunks/shared.js') + gzipOf('static/chunks/page-a.js'))

    const shop = measured.find((r) => r.route === '/(frontend)/shop/page')!
    expect(shop.files).toBe(2)
    expect(missing).toEqual([{ route: '/(frontend)/shop/page', file: 'static/chunks/gone.js' }])

    // Largest first.
    expect(measured.map((r) => r.gzipBytes)).toEqual([...measured.map((r) => r.gzipBytes)].sort((a, b) => b - a))
    expect(measured[0].route).toBe('/(frontend)/page')
  })

  it('flags routes over their limit, using the route entry when there is one', () => {
    const { measured } = measureRoutes(nextDir, readRouteChunks(nextDir)!.routes)
    const budget = JSON.parse(fs.readFileSync(budgetFile, 'utf8'))
    const violations = checkBudget(measured, budget)
    // The home route has its own 0.75 KB limit, the others the 0.5 KB default.
    const expected = measured.filter((r) => r.gzipBytes > (budget.routes[r.route] ?? budget.defaultRouteGzipKB) * 1024)
    expect(violations.map((v) => v.route)).toEqual(expected.map((r) => r.route))
    expect(() => checkBudget(measured, { defaultRouteGzipKB: 0 })).toThrow(/defaultRouteGzipKB/)
  })

  it('reports status missing when there is no build, and a readable report when there is one', () => {
    expect(runBundleSize({ nextDir: path.join(fixture, 'absent'), budgetFile }).status).toBe('missing')
    const result = runBundleSize({ nextDir, budgetFile })
    expect(['ok', 'over']).toContain(result.status)
    expect(result.report).toContain('/(frontend)/page')
    expect(result.report).toContain('Missing files (1)')
    const text = formatReport({ source: 'x', measured: [{ route: '/a', files: 1, rawBytes: 2048, gzipBytes: 1024 }], missing: [], violations: [] })
    expect(text).toContain('2.0 KB')
    expect(text).toContain('Within budget.')
  })

  it('has a committed budget file the script can read', () => {
    const real = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'bundle-budget.json'), 'utf8'))
    expect(real.defaultRouteGzipKB).toBeGreaterThan(0)
  })
})
