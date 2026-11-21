#!/usr/bin/env node
// Builds the files attached to a GitHub release, from an existing OpenNext build (.open-next):
//   release/worker.js        the Worker, bundled as wrangler would deploy it (no bindings, those come from the installer)
//   release/assets.tar.gz    the static assets (_next/static, public files)
//   release/manifest.json    version, notes, migration list, checksums, worker size
//
//   npx opennextjs-cloudflare build && node scripts/make-release.mjs [--prev path/to/previous-manifest.json] [--notes "text"]
//
// `requiresWorkerUpdate` is false when the Worker is byte-identical to the previous release (or --static-only is passed): installs then
// get the new static files without any prompt. `requiresMigration` is true when the migration list differs from the previous release's. `destructive` is true when any
// new migration file contains a DROP TABLE / DROP COLUMN (checked by name in the file, review before releasing).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'release')
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : undefined
}
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

export function migrationNames(dir) {
  return fs.readdirSync(dir).filter((f) => /^\d{8}_\d{6}.*\.ts$/.test(f)).map((f) => f.replace(/\.ts$/, '')).sort()
}

export function diffMigrations(current, previous) {
  const before = new Set(previous)
  return current.filter((m) => !before.has(m))
}

export function isDestructive(sql) {
  return /\bDROP\s+(TABLE|COLUMN)\b/i.test(sql)
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  if (!fs.existsSync(path.join(ROOT, '.open-next/worker.js'))) throw new Error('Run `npx opennextjs-cloudflare build` first.')
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  const tmp = fs.mkdtempSync(path.join(ROOT, '.release-bundle-'))
  try {
    execFileSync('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', tmp], { cwd: ROOT, stdio: 'inherit' })
    fs.copyFileSync(path.join(tmp, 'cloudflare-worker.js'), path.join(OUT, 'worker.js'))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  execFileSync('tar', ['-czf', path.join(OUT, 'assets.tar.gz'), '-C', path.join(ROOT, '.open-next/assets'), '.'])

  const migDir = path.join(ROOT, 'src/migrations')
  const migrations = migrationNames(migDir)
  const prev = arg('--prev') && fs.existsSync(arg('--prev')) ? JSON.parse(fs.readFileSync(arg('--prev'), 'utf8')) : null
  const added = prev ? diffMigrations(migrations, prev.migrations ?? []) : []
  const destructive = added.some((m) => isDestructive(fs.readFileSync(path.join(migDir, `${m}.ts`), 'utf8')))
  const workerBytes = fs.readFileSync(path.join(OUT, 'worker.js'))
  const workerGzipKiB = Math.round(zlib.gzipSync(workerBytes).length / 1024)
  // Cloudflare's limit is the uncompressed size (64 MiB on Free and Paid); gzip is for reference only.
  const workerKiB = Math.round(workerBytes.length / 1024)

  // The Worker only needs redeploying when its code changed. `--static-only` forces false (asset-only release); otherwise the
  // checksum is compared with the previous release's (no previous release counts as changed). New migrations always need the Worker.
  const workerSha = sha256(path.join(OUT, 'worker.js'))
  const requiresWorkerUpdate = process.argv.includes('--static-only') ? added.length > 0 : !prev || prev.assets?.workerSha256 !== workerSha || added.length > 0

  const manifest = {
    version: pkg.version,
    releasedAt: new Date().toISOString(),
    notes: arg('--notes') ?? '',
    migrations,
    requiresMigration: prev ? added.length > 0 : true,
    requiresWorkerUpdate,
    destructive,
    minFromVersion: pkg.engage?.minFromVersion ?? '0.0.0',
    assets: { worker: 'worker.js', assetsArchive: 'assets.tar.gz', workerSha256: sha256(path.join(OUT, 'worker.js')), assetsSha256: sha256(path.join(OUT, 'assets.tar.gz')) },
    workerKiB,
    workerGzipKiB,
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Release ${manifest.version}: worker ${workerKiB} KiB uncompressed (Cloudflare limit 65536), ${workerGzipKiB} KiB gzip, ${added.length} new migration(s).`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
