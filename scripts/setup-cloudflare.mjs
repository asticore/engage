#!/usr/bin/env node
// Creates this site's D1 database and R2 bucket with the wrangler CLI and writes their IDs and names into
// wrangler.jsonc, so a fork or a second Cloudflare account gets its own resources instead of this project's.
//
//   pnpm run setup:cloudflare -- --dry-run          # print what would happen, change nothing
//   pnpm run setup:cloudflare -- --replace          # fork or new account: point wrangler.jsonc at its own D1
//   pnpm run setup:cloudflare -- --worker my-shop   # worker, D1 and bucket all named my-shop
//   pnpm run setup:cloudflare -- --d1 shop-db --bucket shop-media
//
// Names default to the values already in wrangler.jsonc (the worker name, D1 name and bucket name), or to the
// folder name when the file has none. If the database ID in the file would change, the script stops unless
// --replace is given, so the production values in this repo are never rewritten by accident.
//
// Needs wrangler signed in (`npx wrangler login`) or CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID set.
// Idempotent: an existing D1 database or bucket with the chosen name is reused, not recreated, and a second run
// writes nothing that is not already there. Comments in wrangler.jsonc are kept; only the values are rewritten.
// Not run by the deploy button or CI.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** A Cloudflare-safe name: lower case letters, digits and hyphens, no leading or trailing hyphen, 3 to 63 characters. */
export function toCloudflareName(value) {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '')
  if (slug.length < 3) throw new Error(`"${value}" does not make a usable Cloudflare name (3 to 63 letters, digits or hyphens).`)
  return slug
}

/** The values wrangler.jsonc holds right now (first, non-commented occurrence of each key). */
export function currentNames(text) {
  const pick = (re) => {
    const m = text.match(re)
    return m ? m[1] : null
  }
  return {
    workerName: pick(/^\s{0,2}"name":\s*"([^"]*)"/m),
    databaseId: pick(/^\s*"database_id":\s*"([^"]*)"/m),
    databaseName: pick(/^\s*"database_name":\s*"([^"]*)"/m),
    bucketName: pick(/^\s*"bucket_name":\s*"([^"]*)"/m),
    previewBucketName: pick(/^\s*"preview_bucket_name":\s*"([^"]*)"/m),
  }
}

/**
 * Rewrites the four values (and the worker name) in wrangler.jsonc text, leaving every other byte alone.
 * Throws when one of the keys is not present, so a changed file layout fails loudly instead of half-updating.
 */
export function rewriteWranglerConfig(text, names) {
  const replaceFirst = (src, re, value, label) => {
    if (!re.test(src)) throw new Error(`wrangler config has no ${label} line to update.`)
    return src.replace(re, (_all, lead, _old, tail) => `${lead}"${value}"${tail}`)
  }
  let out = text
  out = replaceFirst(out, /^(\s{0,2}"name":\s*)"([^"]*)"(,?)/m, names.workerName, 'worker "name"')
  out = replaceFirst(out, /^(\s*"database_id":\s*)"([^"]*)"(,?)/m, names.databaseId, 'D1 "database_id"')
  out = replaceFirst(out, /^(\s*"database_name":\s*)"([^"]*)"(,?)/m, names.databaseName, 'D1 "database_name"')
  out = replaceFirst(out, /^(\s*"bucket_name":\s*)"([^"]*)"(,?)/m, names.bucketName, 'R2 "bucket_name"')
  out = replaceFirst(out, /^(\s*"preview_bucket_name":\s*)"([^"]*)"(,?)/m, names.bucketName, 'R2 "preview_bucket_name"')
  return out
}

/** Reads the JSON that `wrangler ... --json` prints, skipping any warning lines wrangler writes before it. */
export function parseWranglerJson(output) {
  const start = output.search(/[[{]/)
  if (start < 0) throw new Error('wrangler printed no JSON.')
  return JSON.parse(output.slice(start))
}

/** The D1 database with this name in `wrangler d1 list --json`, or null. */
export function findD1(list, name) {
  const hit = (Array.isArray(list) ? list : []).find((db) => db && db.name === name)
  return hit ? { id: hit.uuid || hit.id || hit.database_id } : null
}

/** Whether `wrangler r2 bucket list` (plain text, one `name: <bucket>` line per bucket) has this bucket. */
export function hasBucket(listText, name) {
  return listText.split('\n').some((line) => line.trim() === `name: ${name}`)
}

/**
 * Applies the setup. `exec(args)` runs wrangler and returns its stdout; it is injected so the logic is testable
 * without a Cloudflare account. Returns the planned or done actions and the new config text.
 */
export function setupCloudflare({ names, configText, exec, dryRun = false, replace = false }) {
  const actions = []
  const before = currentNames(configText)
  const d1List = parseWranglerJson(exec(['d1', 'list', '--json']))
  let database = findD1(d1List, names.d1)
  if (database) {
    actions.push(`reuse D1 database ${names.d1} (${database.id})`)
  } else {
    actions.push(`create D1 database ${names.d1}`)
    if (!dryRun) {
      exec(['d1', 'create', names.d1])
      database = findD1(parseWranglerJson(exec(['d1', 'list', '--json'])), names.d1)
      if (!database?.id) throw new Error(`D1 database ${names.d1} was created but wrangler did not list its ID.`)
    }
  }

  const bucketsText = exec(['r2', 'bucket', 'list'])
  if (hasBucket(bucketsText, names.bucket)) {
    actions.push(`reuse R2 bucket ${names.bucket}`)
  } else {
    actions.push(`create R2 bucket ${names.bucket}`)
    if (!dryRun) exec(['r2', 'bucket', 'create', names.bucket])
  }

  const databaseId = database?.id ?? '<database id after create>'
  if (before.databaseId && before.databaseId !== databaseId && !replace) {
    if (dryRun) actions.push(`would stop: the file's database ID would change (pass --replace)`)
    else throw new Error(
      `wrangler.jsonc already points at D1 database ${before.databaseId}. ` +
        `The database ${names.d1} resolves to ${databaseId}. Pass --replace to change the ID (the production values stay as they are otherwise).`,
    )
  }
  const nextText = rewriteWranglerConfig(configText, {
    workerName: names.worker,
    databaseId,
    databaseName: names.d1,
    bucketName: names.bucket,
  })
  return { actions, changed: nextText !== configText, text: nextText, databaseId }
}

/** Parses the command line. Names not given fall back to the config's current worker name, then the folder name. */
export function parseArgs(argv, configText, folderName) {
  const opts = { worker: null, d1: null, bucket: null, config: path.join(ROOT, 'wrangler.jsonc'), dryRun: false, replace: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const take = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${arg} needs a value.`)
      return value
    }
    if (arg === '--worker') opts.worker = take()
    else if (arg === '--d1') opts.d1 = take()
    else if (arg === '--bucket') opts.bucket = take()
    else if (arg === '--config') opts.config = path.resolve(take())
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--replace') opts.replace = true
    else if (arg === '-h' || arg === '--help') opts.help = true
    else throw new Error(`Unknown option ${arg}. Run with --help.`)
  }
  const current = currentNames(configText)
  const base = toCloudflareName(opts.worker ?? current.workerName ?? folderName)
  // With --worker given, D1 and the bucket follow it. Otherwise the names already in the file are kept, so a rerun
  // on the same account finds the same database and bucket.
  const keep = (value, fallback) => (value && /^[A-Za-z0-9_-]+$/.test(value) ? value : fallback)
  return {
    ...opts,
    names: {
      worker: base,
      d1: opts.d1 ? toCloudflareName(opts.d1) : opts.worker ? base : keep(current.databaseName, base),
      bucket: opts.bucket ? toCloudflareName(opts.bucket) : opts.worker ? base : toCloudflareName(current.bucketName ?? base),
    },
  }
}

function runWrangler(args) {
  return execFileSync('npx', ['--no-install', 'wrangler', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, NO_D1_WARNING: 'true' },
  })
}

function main() {
  const configPath = path.join(ROOT, 'wrangler.jsonc')
  const probe = parseArgs(process.argv.slice(2), fs.readFileSync(configPath, 'utf8'), path.basename(ROOT))
  if (probe.help) {
    console.log('Usage: pnpm run setup:cloudflare -- [--worker NAME] [--d1 NAME] [--bucket NAME] [--config PATH] [--dry-run] [--replace]')
    return
  }
  const configText = fs.readFileSync(probe.config, 'utf8')
  const result = setupCloudflare({ names: probe.names, configText, exec: runWrangler, dryRun: probe.dryRun, replace: probe.replace })
  for (const action of result.actions) console.log(`${probe.dryRun ? '[dry run] ' : ''}${action}`)
  if (probe.dryRun) {
    console.log('[dry run] wrangler.jsonc not changed.')
    return
  }
  if (result.changed) {
    fs.writeFileSync(probe.config, result.text)
    console.log(`Updated ${path.relative(ROOT, probe.config)}: worker ${probe.names.worker}, D1 ${probe.names.d1} (${result.databaseId}), bucket ${probe.names.bucket}.`)
  } else {
    console.log(`${path.relative(ROOT, probe.config)} already has these values; nothing to write.`)
  }
  console.log('Next: review the diff, then run pnpm run deploy:full (or the deploy button) for this account.')
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
