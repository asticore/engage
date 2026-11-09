import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { CLEAR_CONFIRM_WORD, activityRowsToCsv, parseActivityFilter, parseClearScope } from '@/features/security/activityQuery'
import { clearActivity, countClearable, exportActivityRows } from '@/features/security/activityStore'
import { auditContext } from '@/features/security/auditLog'

export const dynamic = 'force-dynamic'

/**
 * GET  /api/admin-activity-log?format=csv&action=&person=&collection=&from=&to=
 *      CSV download of the filtered activity log (capped at 10,000 rows). Admins only.
 * POST /api/admin-activity-log  { mode: 'all' | 'older' | 'person', days?, person?, confirm: 'CLEAR', dryRun? }
 *      Clears entries and records that it happened. Admins only. dryRun returns the count only.
 *      Consent, privacy and earlier clear records are never removed.
 */
export async function GET(request: Request): Promise<Response> {
  const context = await getAdminContext()
  if (!context.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!context.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const rows = await exportActivityRows(parseActivityFilter(params))
  return new Response(activityRowsToCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  })
}

export async function POST(request: Request): Promise<Response> {
  const context = await getAdminContext()
  if (!context.user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!context.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const scope = parseClearScope(body)
  if (!scope) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })

  const raw = body as { confirm?: unknown; dryRun?: unknown }
  if (raw.dryRun === true) return NextResponse.json({ count: await countClearable(scope) })
  if (raw.confirm !== CLEAR_CONFIRM_WORD) return NextResponse.json({ error: `Type ${CLEAR_CONFIRM_WORD} to confirm` }, { status: 400 })

  const user = context.user as { id?: number | string; email?: string }
  const seen = auditContext(request)
  const count = await clearActivity(scope, { id: user.id ?? null, email: user.email ?? null, ip: seen.ip ?? null, userAgent: seen.userAgent ?? null })
  return NextResponse.json({ cleared: count })
}
