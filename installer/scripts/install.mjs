#!/usr/bin/env node
// Build step for a lean Engage install (runs on Cloudflare Workers Builds, or locally with `npm run build`).
// Downloads the release named in engage.config.json from the source repository, checks its checksums and unpacks it to
// .engage/, which wrangler.jsonc deploys. Nothing from the source repository is kept in this repo.
//
//   engage.config.json  { "source": "owner/repo", "version": "latest" | "1.2.3" }
//   ENGAGE_SOURCE        overrides "source" (owner/repo or github.com URL)
//   ENGAGE_SOURCE_TOKEN  needed only if the source repository is private
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, '.engage')

export function parseRepo(value) {
  const m = /^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(value ?? '').trim())
  if (!m) throw new Error(`Source must be "owner/repo" or a github.com URL, got "${value}".`)
  return `${m[1]}/${m[2]}`
}

export function releaseUrl(repo, version, file) {
  return version === 'latest'
    ? `https://github.com/${repo}/releases/latest/download/${file}`
    : `https://github.com/${repo}/releases/download/v${String(version).replace(/^v/, '')}/${file}`
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

/** Rewrites the UPDATE_SOURCE var in a wrangler.jsonc text (adds it after ENGAGE_INSTALL). */
export function withSourceVar(text, repo) {
  const line = `"UPDATE_SOURCE": "${repo}"`
  if (/"UPDATE_SOURCE"\s*:/.test(text)) return text.replace(/"UPDATE_SOURCE"\s*:\s*"[^"]*"/, line)
  return text.replace(/("ENGAGE_INSTALL"\s*:\s*"lean")/, `$1,\n    ${line}`)
}

async function download(repo, version, file, token) {
  if (!token) {
    const res = await fetch(releaseUrl(repo, version, file), { redirect: 'follow' })
    if (!res.ok) throw new Error(`Could not download ${file} from ${repo} ${version} (HTTP ${res.status}).`)
    return Buffer.from(await res.arrayBuffer())
  }
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'engage-installer' }
  const rel = await fetch(`https://api.github.com/repos/${repo}/releases/${version === 'latest' ? 'latest' : `tags/v${String(version).replace(/^v/, '')}`}`, { headers })
  if (!rel.ok) throw new Error(`Could not read the release of ${repo} (HTTP ${rel.status}). Check ENGAGE_SOURCE_TOKEN.`)
  const asset = (await rel.json()).assets?.find((a) => a.name === file)
  if (!asset) throw new Error(`Release has no ${file}.`)
  const res = await fetch(asset.url, { headers: { ...headers, accept: 'application/octet-stream' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`Could not download ${file} (HTTP ${res.status}).`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'engage.config.json'), 'utf8'))
  const repo = parseRepo(process.env.ENGAGE_SOURCE || config.source || 'asticore/engage')
  const version = String(config.version || 'latest')
  const token = (process.env.ENGAGE_SOURCE_TOKEN || '').trim()
  console.log(`Installing Engage ${version} from ${repo}`)

  const manifest = JSON.parse((await download(repo, version, 'manifest.json', token)).toString('utf8'))
  const pinned = manifest.version
  const worker = await download(repo, pinned, manifest.assets.worker, token)
  const assets = await download(repo, pinned, manifest.assets.assetsArchive, token)
  if (manifest.assets.workerSha256 && sha256(worker) !== manifest.assets.workerSha256) throw new Error('worker.js failed its checksum.')
  if (manifest.assets.assetsSha256 && sha256(assets) !== manifest.assets.assetsSha256) throw new Error('assets archive failed its checksum.')

  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(OUT, 'worker.js'), worker)
  fs.writeFileSync(path.join(OUT, 'assets.tar.gz'), assets)
  execFileSync('tar', ['-xzf', path.join(OUT, 'assets.tar.gz'), '-C', path.join(OUT, 'assets')])
  fs.rmSync(path.join(OUT, 'assets.tar.gz'))
  fs.writeFileSync(path.join(OUT, 'installed.json'), JSON.stringify({ source: repo, version: pinned, workerGzipKiB: manifest.workerGzipKiB }, null, 2))

  const wrangler = path.join(ROOT, 'wrangler.jsonc')
  fs.writeFileSync(wrangler, withSourceVar(fs.readFileSync(wrangler, 'utf8'), repo))
  console.log(`Installed ${pinned} (worker ${manifest.workerGzipKiB} KiB gzip).`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
