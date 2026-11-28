#!/usr/bin/env node
// Build step: makes sure the site has its two required secrets, so the customer never has to invent them.
// Runs after install.mjs on Cloudflare Workers Builds. For each secret that is not set on the Worker yet it generates a random value
// and stores it with `wrangler secret put`. Secrets that already exist are never touched (changing ENGAGE_SECRET would sign everyone
// out and break encrypted settings). Failures only warn: the build still succeeds and the secrets can be added in the dashboard.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const REQUIRED_SECRETS = ['ENGAGE_SECRET', 'INTERNAL_ROUTE_KEY']

export function newSecret() {
  return randomBytes(32).toString('hex')
}

/** Names from `wrangler secret list --format json` output. Returns null when the output is not the expected list. */
export function parseSecretNames(output) {
  try {
    const list = JSON.parse(output)
    return Array.isArray(list) ? list.map((s) => s?.name).filter(Boolean) : null
  } catch {
    return null
  }
}

function wrangler(args, input) {
  return execFileSync('npx', ['--no-install', 'wrangler', ...args], { cwd: ROOT, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] })
}

function main() {
  let existing = []
  try {
    existing = parseSecretNames(wrangler(['secret', 'list', '--format', 'json'])) ?? []
  } catch {
    // The Worker does not exist yet on the first build: nothing is set.
  }
  const missing = REQUIRED_SECRETS.filter((name) => !existing.includes(name) && !process.env[name])
  for (const name of missing) {
    try {
      wrangler(['secret', 'put', name], newSecret())
      console.log(`Generated ${name}.`)
    } catch (error) {
      console.warn(`Could not generate ${name} (${String(error?.stderr || error?.message || error).split('\n')[0]}). Add it in Cloudflare: Settings, Variables and Secrets.`)
    }
  }
  if (!missing.length) console.log('Required secrets already set.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
