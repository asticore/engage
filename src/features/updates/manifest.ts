/**
 * manifest.json is attached to every GitHub release by scripts/make-release.mjs. It is the only thing an
 * installed site reads to decide whether an update exists and what it involves.
 */

export type ReleaseManifest = {
  version: string
  /** ISO date of the release. */
  releasedAt: string
  /** Release notes shown in the popup. */
  notes: string
  /** Names of every schema/data migration in this release, in order. */
  migrations: string[]
  /** True when this release changes the database (new tables/columns or data moves). */
  requiresMigration: boolean
  /** True when the Worker code changed, so the install must redeploy. False when only static files (admin assets, builder scripts) changed. Absent in older manifests, read as true. */
  requiresWorkerUpdate: boolean
  /** True when it drops or rewrites existing data. The admin must approve explicitly. */
  destructive: boolean
  /** The oldest installed version that may update straight to this one. Older sites update in steps. */
  minFromVersion: string
  /** Release asset names and sha256 checks. */
  assets: { worker: string; assetsArchive: string; workerSha256: string; assetsSha256: string }
  /** gzip size of the worker in KiB (Cloudflare's free plan allows 3072). */
  workerKiB: number
  workerGzipKiB: number
}

export function parseManifest(input: unknown): ReleaseManifest {
  const m = input as Partial<ReleaseManifest> | null
  if (!m || typeof m !== 'object') throw new Error('Release manifest is not an object.')
  if (typeof m.version !== 'string' || !m.version) throw new Error('Release manifest has no version.')
  const assets = (m.assets ?? {}) as Partial<ReleaseManifest['assets']>
  return {
    version: m.version.replace(/^v/, ''),
    releasedAt: String(m.releasedAt ?? ''),
    notes: String(m.notes ?? ''),
    migrations: Array.isArray(m.migrations) ? m.migrations.map(String) : [],
    requiresMigration: Boolean(m.requiresMigration),
    requiresWorkerUpdate: m.requiresWorkerUpdate === undefined ? true : Boolean(m.requiresWorkerUpdate),
    destructive: Boolean(m.destructive),
    minFromVersion: String(m.minFromVersion ?? '0.0.0').replace(/^v/, ''),
    assets: {
      worker: String(assets.worker ?? 'worker.js'),
      assetsArchive: String(assets.assetsArchive ?? 'assets.tar.gz'),
      workerSha256: String(assets.workerSha256 ?? ''),
      assetsSha256: String(assets.assetsSha256 ?? ''),
    },
    workerKiB: Number(m.workerKiB ?? 0),
    workerGzipKiB: Number(m.workerGzipKiB ?? 0),
  }
}
