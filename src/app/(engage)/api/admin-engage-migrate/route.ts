import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import pkg from '../../../../../package.json'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getAppliedVersion, pendingMigrationNames, setAppliedVersion } from '@/features/updates/state'
import { consoleLogger } from '@/localapi/logger'
import { EARLY_MIGRATIONS, LATE_MIGRATIONS, runInternalMigrate } from '@/migrations/runInternalMigrate'

export const dynamic = 'force-dynamic'

async function guard(): Promise<Response | null> {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  return ctx.isAdmin ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** GET: { running, applied, pending, pendingNames }. `pending` is true only when a migration this code runs is not yet recorded. Super admins only. */
export async function GET(): Promise<Response> {
  const denied = await guard()
  if (denied) return denied
  const { env } = await getCloudflareContext({ async: true })
  const applied = env.D1 ? await getAppliedVersion(env.D1).catch((): null => null) : null
  const expected = [...EARLY_MIGRATIONS, ...LATE_MIGRATIONS].map((m) => m.name)
  const pendingNames = env.D1 ? await pendingMigrationNames(env.D1, expected).catch((): string[] => []) : []
  return NextResponse.json({ running: pkg.version, applied, pending: pendingNames.length > 0, pendingNames }, { headers: { 'Cache-Control': 'no-store' } })
}

/** POST: run the additive/replay-safe migrations for the running version, then record it. */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ ok: false, error: refusal }, { status: 403 })
  const denied = await guard()
  if (denied) return denied
  const { env } = await getCloudflareContext({ async: true })
  if (!env.D1) return NextResponse.json({ ok: false, error: 'No D1 binding available.' }, { status: 500 })
  const { results, errorCount } = await runInternalMigrate(env.D1, consoleLogger, {})
  if (errorCount === 0) await setAppliedVersion(env.D1, pkg.version)
  return NextResponse.json({ ok: errorCount === 0, errorCount, results }, { status: errorCount === 0 ? 200 : 500 })
}
