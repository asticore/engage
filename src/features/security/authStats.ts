import { lastDays } from '@/views/dashboard/dashboardData'

/**
 * Sign-in numbers for the dashboard, read from the audit log (`eg_audit_log`). Pure aggregation
 * over rows of (action, created_at), so it is easy to test; `loadAuthStats` does the one read.
 */

export type AuthRow = { action: string; created_at: string }
export type AuthStats = {
  days: { day: string; failed: number; success: number }[]
  methods: { id: string; label: string; count: number }[]
  failedTotal: number
  successTotal: number
}

const METHODS: Record<string, string> = {
  'login.success': 'Password',
  'social.login': 'Social',
  'passwordless.login': 'Email link or code',
  'passkey.login': 'Passkey',
}

export function buildAuthStats(rows: readonly AuthRow[], days: number, now: Date): AuthStats {
  const list = lastDays(days, now)
  const byDay = new Map(list.map((day) => [day, { day, failed: 0, success: 0 }]))
  const methods = new Map<string, number>()
  let failedTotal = 0
  let successTotal = 0
  for (const row of rows) {
    const bucket = byDay.get(String(row.created_at).slice(0, 10))
    if (!bucket) continue
    if (row.action === 'login.failed') {
      bucket.failed += 1
      failedTotal += 1
    } else if (METHODS[row.action]) {
      bucket.success += 1
      successTotal += 1
      methods.set(row.action, (methods.get(row.action) ?? 0) + 1)
    }
  }
  return {
    days: list.map((d) => byDay.get(d)!),
    methods: [...methods].map(([id, count]) => ({ id, label: METHODS[id], count })).sort((a, b) => b.count - a.count),
    failedTotal,
    successTotal,
  }
}

type D1Like = { prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<{ results?: unknown[] }> } } }

/** The last `days` days of sign-in events. Null when the log cannot be read. */
export async function loadAuthStats(db: D1Like, days: number, now: Date): Promise<AuthStats | null> {
  try {
    const since = `${lastDays(days, now)[0]}T00:00:00.000Z`
    const { results } = await db
      .prepare("SELECT action, created_at FROM `eg_audit_log` WHERE created_at >= ? AND action IN ('login.success','login.failed','social.login','passwordless.login','passkey.login') ORDER BY created_at DESC LIMIT 20000")
      .bind(since)
      .all()
    return buildAuthStats((results ?? []) as AuthRow[], days, now)
  } catch {
    return null
  }
}

export type AccountCounts = { signUps: number; activeSessions: number }

/** New accounts in the last `days` days and sessions that have not expired. Null when the tables cannot be read. */
export async function loadAccountCounts(db: D1Like, days: number, now: Date, until?: string): Promise<AccountCounts | null> {
  try {
    const since = `${lastDays(days, now)[0]}T00:00:00.000Z`
    const count = async (sql: string, value: string): Promise<number> => {
      const { results } = await db.prepare(sql).bind(value, ...(until && sql.includes('created_at') ? [until] : [])).all()
      return Number((results?.[0] as { n?: number } | undefined)?.n ?? 0)
    }
    const [signUps, activeSessions] = await Promise.all([
      count(`SELECT COUNT(*) AS n FROM \`eg_users\` WHERE created_at >= ?${until ? ' AND created_at < ?' : ''}`, since),
      count('SELECT COUNT(*) AS n FROM `eg_users_sessions` WHERE expires_at > ?', now.toISOString()),
    ])
    return { signUps, activeSessions }
  } catch {
    return null
  }
}
