#!/usr/bin/env node
// Measures the JavaScript each route loads on first visit, from the build output Next writes to .next, and
// checks it against bundle-budget.json. Run after a build:
//
//   pnpm run build && pnpm run bundle:size
//   pnpm run bundle:size -- --dir .next --budget bundle-budget.json --require
//
// Sizes are read from the chunk files on disk, per route, from .next/app-build-manifest.json (or the pages
// section of .next/build-manifest.json for older builds). A chunk shared by several routes counts once per route,
// which is what the browser downloads on that route's first visit. Gzip sizes use zlib level 9.
// With no .next folder the script says so and exits 0 (use --require to make that an error, e.g. on a live build).
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

/**
 * Route -> the build-relative JS files that route loads. Reads app-build-manifest.json first (App Router), then
 * the pages section of build-manifest.json. Returns null when neither file exists.
 */
export function readRouteChunks(nextDir) {
  for (const name of ['app-build-manifest.json', 'build-manifest.json']) {
    const file = path.join(nextDir, name)
    if (!fs.existsSync(file)) continue
    const manifest = readJson(file)
    const pages = manifest.pages && typeof manifest.pages === 'object' ? manifest.pages : null
    if (pages) return { source: name, routes: pages }
  }
  return null
}

/**
 * Per-route JS sizes. `missing` lists files the manifest names but the disk does not have (a broken build or a
 * manifest from another build); they are left out of the sizes rather than counted as zero.
 */
export function measureRoutes(nextDir, routes) {
  const measured = []
  const missing = []
  for (const [route, files] of Object.entries(routes)) {
    const jsFiles = [...new Set(files)].filter((f) => typeof f === 'string' && f.endsWith('.js'))
    let rawBytes = 0
    let gzipBytes = 0
    const present = []
    for (const rel of jsFiles) {
      const file = path.join(nextDir, rel)
      if (!fs.existsSync(file)) {
        missing.push({ route, file: rel })
        continue
      }
      const buf = fs.readFileSync(file)
      rawBytes += buf.length
      gzipBytes += gzipSync(buf, { level: 9 }).length
      present.push(rel)
    }
    measured.push({ route, files: present.length, rawBytes, gzipBytes })
  }
  measured.sort((a, b) => b.gzipBytes - a.gzipBytes || a.route.localeCompare(b.route))
  return { measured, missing }
}

/**
 * Budget file shape: { "defaultRouteGzipKB": n, "routes": { "/route": n } }. A route with its own entry uses it,
 * every other route the default. Returns one violation per route over its limit, largest first.
 */
export function checkBudget(measured, budget) {
  const fallback = Number(budget.defaultRouteGzipKB)
  if (!Number.isFinite(fallback) || fallback <= 0) throw new Error('bundle-budget.json needs a positive defaultRouteGzipKB.')
  const violations = []
  for (const row of measured) {
    const limitKB = Number(budget.routes?.[row.route] ?? fallback)
    const limit = limitKB * 1024
    if (row.gzipBytes > limit) violations.push({ route: row.route, gzipBytes: row.gzipBytes, limitBytes: limit })
  }
  return violations.sort((a, b) => b.gzipBytes - a.gzipBytes)
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

/** Plain-text table for the terminal: route, files, raw and gzip size, and a line per violation. */
export function formatReport({ source, measured, missing, violations, limitTop = 15 }) {
  const lines = [`Source: ${source}. Routes measured: ${measured.length}.`, '', 'Route                                  files    raw        gzip']
  for (const row of measured.slice(0, limitTop)) {
    lines.push(`${row.route.padEnd(36).slice(0, 36)} ${String(row.files).padStart(5)}  ${kb(row.rawBytes).padStart(10)}  ${kb(row.gzipBytes).padStart(10)}`)
  }
  if (measured.length > limitTop) lines.push(`... ${measured.length - limitTop} more routes`)
  if (missing.length) lines.push('', `Missing files (${missing.length}): ${missing.map((m) => `${m.route} -> ${m.file}`).join('; ')}`)
  lines.push('')
  lines.push(violations.length ? `Over budget (${violations.length}):` : 'Within budget.')
  for (const v of violations) lines.push(`  ${v.route}: ${kb(v.gzipBytes)} gzip, limit ${kb(v.limitBytes)}`)
  return lines.join('\n')
}

/** Runs the measurement. Returns a status: 'missing' (no build), 'ok', or 'over' (budget exceeded). */
export function runBundleSize({ nextDir, budgetFile, require = false }) {
  if (!fs.existsSync(nextDir)) return { status: 'missing', message: `No build output at ${nextDir}. Run pnpm run build first.` }
  const chunks = readRouteChunks(nextDir)
  if (!chunks) return { status: 'missing', message: `${nextDir} has no app-build-manifest.json or build-manifest.json.` }
  const budget = readJson(budgetFile)
  const { measured, missing } = measureRoutes(nextDir, chunks.routes)
  const violations = checkBudget(measured, budget)
  return {
    status: violations.length ? 'over' : 'ok',
    report: formatReport({ source: chunks.source, measured, missing, violations }),
    measured,
    missing,
    violations,
    require,
  }
}

function main() {
  const args = process.argv.slice(2)
  const value = (flag, fallback) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : fallback
  }
  const nextDir = path.resolve(ROOT, value('--dir', '.next'))
  const budgetFile = path.resolve(ROOT, value('--budget', 'bundle-budget.json'))
  const require = args.includes('--require')
  const result = runBundleSize({ nextDir, budgetFile, require })
  if (result.status === 'missing') {
    console.log(`${result.message} Bundle size not measured.`)
    process.exit(require ? 1 : 0)
  }
  console.log(result.report)
  process.exit(result.status === 'over' ? 1 : 0)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
