import { NextResponse } from 'next/server'
import { drizzle } from 'drizzle-orm/d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { getEngine } from '@/engine'
import { JOB_RUNNERS } from '@/features/cron/jobs'
import { canDisableJob, setJobEnabled } from '@/features/cron/jobState'
import { CRON_JOBS } from '@/features/cron/registry'
import { runJob } from '@/features/cron/runJob'
import { adminRequestRefusal } from '@/features/forms/origin'
import { audit, auditContext } from '@/features/security/auditLog'
import { getSecuritySettings } from '@/features/security/settings'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST /api/admin-cron-job  { job, action: 'run' | 'enable' | 'disable' }
 * Admin only. `run` runs the job now through the same runner and run log as the timer (so it shows in the history);
 * `enable` and `disable` switch a job on or off for the timer. The publishing job cannot be switched off.
 * Every action is written to the audit log.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const refusal = adminRequestRefusal(request)
    if (refusal) return json({ error: refusal }, 403)
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user)) return json({ error: 'Unauthorised' }, 401)
    if (!context.isAdmin) return json({ error: 'Forbidden' }, 403)

    const body = (await request.json().catch((): null => null)) as { job?: unknown; action?: unknown } | null
    const job = typeof body?.job === 'string' ? body.job : ''
    const action = body?.action
    const def = CRON_JOBS.find((j) => j.name === job)
    if (!def || (action !== 'run' && action !== 'enable' && action !== 'disable')) return json({ error: 'Unknown job or action.' }, 400)

    const { env } = await getCloudflareContext({ async: true })
    let detail = ''
    let result: Record<string, unknown> = { job, action }

    if (action === 'run') {
      const runner = JOB_RUNNERS[job]
      if (!runner) return json({ error: 'This job runs from its own screen (Backups), not from here.' }, 400)
      const now = new Date()
      const engine = await getEngine()
      const outcome = await runJob(job, () => runner({ engine, env, db: drizzle(env.D1), now }))
      result = { ...result, status: outcome.status, error: outcome.status === 'failed' ? outcome.error : null }
      detail = `Ran job ${job} now: ${outcome.status}`
    } else {
      if (!canDisableJob(job)) return json({ error: 'That job cannot be switched off.' }, 400)
      await setJobEnabled(env.D1, job, action === 'enable', new Date().toISOString())
      detail = `${action === 'enable' ? 'Switched on' : 'Switched off'} job ${job}`
    }

    try {
      await audit(
        {
          action: 'update',
          collectionSlug: 'cron',
          documentId: job,
          actorId: (context.user as { id?: number | string } | null)?.id ?? null,
          actorEmail: (context.user as { email?: string } | null)?.email ?? null,
          detail,
          ...auditContext(request),
        },
        await getSecuritySettings(context.engine as never),
      )
    } catch {
      // The action is done; a failed audit write is logged by auditLog.ts.
    }
    return json(result)
  } catch (error) {
    console.error('admin-cron-job POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

