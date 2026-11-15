import { CRON_JOBS, type CronSchedule } from './registry'

/**
 * Which scheduled jobs an admin has switched off (table `eg_cron_job_state`, one row per job that was ever toggled).
 * A job with no row is on. The heartbeat job `schedules` (scheduled publishing, and the signal that the cron is alive)
 * cannot be switched off. Pure rules here; the D1 reads and writes are below and never throw into the cron route:
 * if the table cannot be read, every job counts as on.
 */

export const NEVER_DISABLED = ['schedules'] as const

export const canDisableJob = (name: string): boolean => CRON_JOBS.some((job) => job.name === name) && !(NEVER_DISABLED as readonly string[]).includes(name)

/** The next time the cron route will run a job with this schedule, after `now`. The cron fires at minutes 0, 5, 10 and so on, UTC. */
export function nextRunAt(schedule: CronSchedule, now: Date): Date {
  const tick = 5 * 60 * 1000
  const nextTick = Math.floor(now.getTime() / tick) * tick + tick
  if (schedule === 'every 5 minutes') return new Date(nextTick)
  // Hourly jobs run on the first tick of each hour (minutes 0 to 4).
  const hour = 60 * 60 * 1000
  return new Date(Math.floor(now.getTime() / hour) * hour + hour)
}

export async function listDisabledJobs(db: D1Database | null | undefined): Promise<Set<string>> {
  if (!db) return new Set()
  try {
    const rows = await db.prepare('SELECT job FROM `eg_cron_job_state` WHERE enabled = 0').all()
    return new Set((rows.results as { job: string }[]).map((r) => r.job))
  } catch {
    return new Set()
  }
}

export async function setJobEnabled(db: D1Database, job: string, enabled: boolean, nowIso: string): Promise<void> {
  if (!canDisableJob(job)) throw new Error('That job cannot be switched off.')
  await db
    .prepare('INSERT INTO `eg_cron_job_state` (job, enabled, updated_at) VALUES (?, ?, ?) ON CONFLICT(job) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at')
    .bind(job, enabled ? 1 : 0, nowIso)
    .run()
}
