import { NextResponse } from 'next/server'
import { drizzle } from 'drizzle-orm/d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getEngine } from '@/engine'
import { CRON_JOBS } from '@/features/cron/registry'
import { JOB_RUNNERS } from '@/features/cron/jobs'
import { listDisabledJobs } from '@/features/cron/jobState'
import { isHourlyTick } from '@/features/cron/model'
import { runJob } from '@/features/cron/runJob'

export const dynamic = 'force-dynamic'

/**
 * POST/GET: Execute scheduled publish/unpublish actions for documents whose
 * schedules have reached their time.
 *
 * Authentication: requires header `x-cron-key` equal to hex(SHA-256(ENGAGE_SECRET + ':cron'))
 * computed with constant-time comparison. Returns 401 if missing or invalid.
 *
 * If ENGAGE_SECRET is unset, returns 401.
 */
export async function POST(request: Request): Promise<Response> {
  return handleCronRequest(request)
}

export async function GET(request: Request): Promise<Response> {
  return handleCronRequest(request)
}

async function handleCronRequest(request: Request): Promise<Response> {
  const engageSecret = process.env.ENGAGE_SECRET

  // Fail if ENGAGE_SECRET is not set
  if (!engageSecret) {
    return NextResponse.json({ error: 'ENGAGE_SECRET not configured' }, { status: 401 })
  }

  const providedKey = request.headers.get('x-cron-key')
  if (!providedKey) {
    return NextResponse.json({ error: 'Missing x-cron-key header' }, { status: 401 })
  }

  try {
    // Compute the expected key: hex(SHA-256(ENGAGE_SECRET + ':cron'))
    const message = new TextEncoder().encode(`${engageSecret}:cron`)
    const hashBuffer = await crypto.subtle.digest('SHA-256', message)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const expectedKey = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

    // Constant-time comparison of the two hex strings
    if (providedKey.length !== expectedKey.length) {
      return NextResponse.json({ error: 'Invalid x-cron-key' }, { status: 401 })
    }
    let diff = 0
    for (let i = 0; i < expectedKey.length; i++) diff |= providedKey.charCodeAt(i) ^ expectedKey.charCodeAt(i)
    if (diff !== 0) {
      return NextResponse.json({ error: 'Invalid x-cron-key' }, { status: 401 })
    }

    // Key is valid - run every job. Each one is recorded in eg_cron_runs by runJob,
    // and a failing job is reported to the error log without stopping the rest. The bodies are in
    // src/features/cron/jobs.ts (one per registry name); hourly jobs run on the first tick of the hour and a
    // job an admin switched off on the Scheduled tasks screen is skipped.
    const engine = await getEngine()
    const { env } = await getCloudflareContext({ async: true })
    const db = drizzle(env.D1)
    const now = new Date()
    const hourly = isHourlyTick(now)
    const ctx = { engine, env, db, now }
    const disabled = await listDisabledJobs(env.D1)

    // Scheduled publishing first: it is also the heartbeat, and a failure here stops the tick.
    const scheduled = await runJob('schedules', () => JOB_RUNNERS.schedules(ctx))
    if (scheduled.status !== 'ok') {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    for (const job of CRON_JOBS) {
      if (job.source !== 'cron' || job.name === 'schedules') continue
      const runner = JOB_RUNNERS[job.name]
      if (!runner) continue
      await runJob(job.name, () => runner(ctx), { due: !disabled.has(job.name) && (job.schedule === 'every 5 minutes' || hourly) })
    }

    return NextResponse.json(scheduled.value, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('cron/publish-scheduled error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
