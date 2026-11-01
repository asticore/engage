import { adminEmails } from '@/features/security/sensitiveChanges'

/**
 * Error spike alert. Runs from the cron tick (see src/features/cron/registry.ts).
 *
 * Counts the error-log entries that were first seen in the last 15 minutes.
 * When that reaches the threshold on the Speed settings (Error alerts group,
 * default 10), every admin gets one email. The email log is the rate limit:
 * no more than one alert email an hour, judged by the rows already written
 * with the `error.spike` template. Repeats of an old error are not counted
 * (they only move last_seen), so a single error firing again does not alert.
 *
 * Never throws. The cron job wraps it too, but a failing alert must not stop the tick.
 */

export const ERROR_ALERT_TEMPLATE = 'error.spike'
export const ERROR_ALERT_WINDOW_MS = 15 * 60 * 1000
export const ERROR_ALERT_GAP_MS = 60 * 60 * 1000
export const ERROR_ALERT_DEFAULT_THRESHOLD = 10
export const ERROR_ALERT_MAX_THRESHOLD = 1000

export type ErrorAlertSettings = { enabled: boolean; threshold: number }

export type ErrorAlertDecision = { send: boolean; reason: 'off' | 'below' | 'recent' | 'spike' }

/** Reads the Error alerts group from the Speed settings row. Anything missing or out of range falls back to the default. */
export function errorAlertSettingsFrom(raw: unknown): ErrorAlertSettings {
  const group = (raw && typeof raw === 'object' ? (raw as { errorAlerts?: unknown }).errorAlerts : null) as
    | { enabled?: unknown; threshold?: unknown }
    | null
  const enabled = group?.enabled === undefined || group?.enabled === null ? true : Boolean(group.enabled)
  const parsed = Math.floor(Number(group?.threshold))
  const threshold =
    Number.isFinite(parsed) && parsed >= 1 && parsed <= ERROR_ALERT_MAX_THRESHOLD ? parsed : ERROR_ALERT_DEFAULT_THRESHOLD
  return { enabled, threshold }
}

/** Pure rule: send when on, the count has reached the threshold, and no alert went out in the last hour. */
export function decideErrorAlert(input: {
  settings: ErrorAlertSettings
  count: number
  lastSentMs: number | null
  nowMs: number
}): ErrorAlertDecision {
  if (!input.settings.enabled) return { send: false, reason: 'off' }
  if (input.count < input.settings.threshold) return { send: false, reason: 'below' }
  if (input.lastSentMs !== null && input.nowMs - input.lastSentMs < ERROR_ALERT_GAP_MS) return { send: false, reason: 'recent' }
  return { send: true, reason: 'spike' }
}

type AlertEngine = {
  count: (args: Record<string, unknown>) => Promise<{ totalDocs: number }>
  find: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }>
  findGlobal?: (args: Record<string, unknown>) => Promise<unknown>
}

export type ErrorAlertReport = { checked: boolean; sent: boolean; reason?: ErrorAlertDecision['reason']; count?: number; error?: string }

/** Checks the last 15 minutes and emails the admins when the spike rule says so. */
export async function runErrorSpikeAlert(engine: AlertEngine, now: Date = new Date()): Promise<ErrorAlertReport> {
  try {
    const nowMs = now.getTime()
    const settings = errorAlertSettingsFrom(await engine.findGlobal?.({ slug: 'speed-settings', depth: 0 }).catch((): null => null))
    if (!settings.enabled) return { checked: false, sent: false, reason: 'off' }

    const since = new Date(nowMs - ERROR_ALERT_WINDOW_MS).toISOString()
    const { totalDocs: count } = await engine.count({
      collection: 'error-log',
      where: { firstSeen: { greater_than_equal: since } },
      overrideAccess: true,
    })
    if (count < settings.threshold) return { checked: true, sent: false, reason: 'below', count }

    const recent = await engine.find({
      collection: 'email-log',
      where: { template: { equals: ERROR_ALERT_TEMPLATE }, createdAt: { greater_than: new Date(nowMs - ERROR_ALERT_GAP_MS).toISOString() } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const lastSent = recent.docs[0] as { createdAt?: string } | undefined
    const decision = decideErrorAlert({
      settings,
      count,
      lastSentMs: lastSent?.createdAt ? Date.parse(lastSent.createdAt) : null,
      nowMs,
    })
    if (!decision.send) return { checked: true, sent: false, reason: decision.reason, count }

    const to = await adminEmails(engine)
    if (to.length === 0) return { checked: true, sent: false, reason: 'spike', count }

    const { sendEmail } = await import('@/features/email')
    await sendEmail({
      to,
      template: ERROR_ALERT_TEMPLATE,
      subject: `Error spike on this site: ${count} new errors in 15 minutes`,
      text: [
        `${count} new errors were logged in the last 15 minutes (alert threshold ${settings.threshold}).`,
        '',
        'Open the Error log in the admin to see what went wrong. Repeats of an error are counted there, not here.',
        'You will not get another alert email about errors for one hour.',
      ].join('\n'),
    })
    return { checked: true, sent: true, reason: 'spike', count }
  } catch (error) {
    return { checked: false, sent: false, error: String((error as Error)?.message || error) }
  }
}
