#!/usr/bin/env node
// Copies the live site's data (the D1 database and, when rclone is set up, the R2 files) onto a staging site.
// Run it from a computer that is signed in to Cloudflare (`npx wrangler login`). It changes only the STAGING side.
//
//   node scripts/copy-live-to-staging.mjs --live-db Gracengatsby --staging-db my-app-staging            (dry run: shows the plan)
//   node scripts/copy-live-to-staging.mjs --live-db Gracengatsby --staging-db my-app-staging --confirm  (does it)
//
// Optional files copy (needs rclone with two remotes configured for R2, see docs):
//   --live-bucket gracengatsby --staging-bucket my-app-staging --rclone-live r2live --rclone-staging r2staging
//
// Safety: the staging database name must differ from the live one and contain "staging" (override with --any-name).
// Everything in the staging database is replaced. Staging then holds real customer data: keep SITE_ENV=staging on it
// (emails off, payments blocked, search engines blocked) and do not share it.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

/** Pure: the plan and the refusals for the given options. Exported for the tests. */
export function planCopy(options) {
  const problems = []
  const { liveDb, stagingDb, anyName } = options
  if (!liveDb || !stagingDb) problems.push('Give both --live-db and --staging-db (the D1 database names).')
  if (liveDb && stagingDb && liveDb === stagingDb) problems.push('The staging database is the same as the live one. Nothing was changed.')
  if (stagingDb && !anyName && !/staging/i.test(stagingDb)) problems.push('The staging database name must contain "staging" (or pass --any-name if you are sure).')
  const files = Boolean(options.liveBucket && options.stagingBucket)
  if (files && options.liveBucket === options.stagingBucket) problems.push('The staging bucket is the same as the live one. Nothing was changed.')
  if (files && !(options.rcloneLive && options.rcloneStaging)) problems.push('The files copy needs --rclone-live and --rclone-staging (the rclone remote names).')
  const steps = [
    `Export the live database "${liveDb}" (remote) to a temporary file`,
    `Drop every table in the staging database "${stagingDb}" (remote)`,
    `Import the export into "${stagingDb}"`,
    ...(files ? [`Sync files from bucket "${options.liveBucket}" to "${options.stagingBucket}" with rclone`] : ['Skip the files copy (no buckets given)']),
  ]
  return { problems, steps, files }
}

/** Pure: the SQL that empties a database, from the names found in sqlite_master. */
export function dropAllSql(names) {
  return names
    .filter((n) => !n.startsWith('sqlite_') && !n.startsWith('_cf_'))
    .map((n) => `DROP TABLE IF EXISTS \`${n.replaceAll('`', '')}\`;`)
    .join('\n')
}

function run(cmd, cmdArgs, opts = {}) {
  const result = spawnSync(cmd, cmdArgs, { stdio: opts.capture ? ['inherit', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`\nStopped: "${cmd} ${cmdArgs.join(' ')}" failed. The staging site may be half copied; run the script again to redo it.`)
    process.exit(1)
  }
  return result.stdout ?? ''
}

function main() {
  const options = {
    liveDb: value('live-db'),
    stagingDb: value('staging-db'),
    liveBucket: value('live-bucket'),
    stagingBucket: value('staging-bucket'),
    rcloneLive: value('rclone-live'),
    rcloneStaging: value('rclone-staging'),
    anyName: flag('any-name'),
  }
  const plan = planCopy(options)
  if (plan.problems.length > 0) {
    for (const problem of plan.problems) console.error(`- ${problem}`)
    process.exit(2)
  }
  console.log('Plan:')
  plan.steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`))
  if (!flag('confirm')) {
    console.log('\nDry run only. Add --confirm to do it. The staging database will be emptied first.')
    return
  }
  const dir = mkdtempSync(join(tmpdir(), 'live-to-staging-'))
  const dump = join(dir, 'live.sql')
  const drop = join(dir, 'drop.sql')

  console.log('\n1/4 Exporting the live database...')
  run('npx', ['wrangler', 'd1', 'export', options.liveDb, '--remote', '--output', dump])

  console.log('\n2/4 Emptying the staging database...')
  const listing = run('npx', ['wrangler', 'd1', 'execute', options.stagingDb, '--remote', '--json', '--command', "SELECT name FROM sqlite_master WHERE type = 'table'"], { capture: true })
  const rows = JSON.parse(listing)?.[0]?.results ?? []
  writeFileSync(drop, `PRAGMA defer_foreign_keys = TRUE;\n${dropAllSql(rows.map((r) => String(r.name)))}\n`)
  run('npx', ['wrangler', 'd1', 'execute', options.stagingDb, '--remote', '--yes', '--file', drop])

  console.log('\n3/4 Importing into staging...')
  // The export can start with its own PRAGMA lines; the statements are plain SQL, so execute accepts the file.
  if (!readFileSync(dump, 'utf8').trim()) {
    console.error('The export was empty, so nothing was imported.')
    process.exit(1)
  }
  run('npx', ['wrangler', 'd1', 'execute', options.stagingDb, '--remote', '--yes', '--file', dump])

  if (plan.files) {
    console.log('\n4/4 Copying files...')
    run('rclone', ['sync', `${options.rcloneLive}:${options.liveBucket}`, `${options.rcloneStaging}:${options.stagingBucket}`, '--progress'])
  } else {
    console.log('\n4/4 Files not copied (no buckets given).')
  }
  console.log('\nDone. Open the staging site and check the Staging banner shows in admin.')
}

if (import.meta.url === `file://${process.argv[1]}`) main()
