import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { runBackup } from '@/features/backups/run'
import { adminRequestRefusal } from '@/features/forms/origin'
import { checkForUpdate } from '@/features/updates/check'
import { readConnection } from '@/features/updates/connection'
import { applyForkUpdate, isLeanInstall, pinInstallVersion } from '@/features/updates/oneClick'
import { parseVersion, upstreamRepo } from '@/features/updates/versions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin-update-apply: update this site. Super admins only (an admin is the top role).
 *  - Fork: sync the fork with upstream using the site's GitHub token.
 *  - This only updates the code (the Worker). Table changes are a separate step: POST /api/admin-engage-migrate.
 *  - Lean install (ENGAGE_INSTALL=lean): back up to R2, then commit the new release version to the install repository.
 *    Body `{ version }` picks a release (a rollback uses the previous one and skips the backup); `{ skipBackup: true }` continues without a copy.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ ok: false, message: refusal }, { status: 403 })
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return NextResponse.json({ ok: false, message: 'Unauthorised' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 })
  const { env } = await getCloudflareContext({ async: true })
  const config = await readConnection(env.D1, process.env.UPDATE_REPO, process.env.UPDATE_GITHUB_TOKEN)

  if (!isLeanInstall(process.env.ENGAGE_INSTALL)) {
    const result = await applyForkUpdate(config)
    return NextResponse.json(result, { status: result.ok ? 200 : result.status === 'not-configured' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } })
  }

  const body = (await request.json().catch((): Record<string, unknown> => ({}))) as { version?: unknown; rollback?: unknown; skipBackup?: unknown; confirmDestructive?: unknown }
  let version = parseVersion(body.version)?.join('.') ?? null
  if (!version) {
    const latest = await checkForUpdate('0.0.0', process.env.UPDATE_REPO, fetch, new Date(), upstreamRepo(process.env.UPDATE_SOURCE))
    version = latest.latest
  }
  if (!version) return NextResponse.json({ ok: false, message: 'Could not work out which version to install.' }, { status: 502 })
  if (body.rollback !== true && body.confirmDestructive !== true) {
    const info = await checkForUpdate('0.0.0', process.env.UPDATE_REPO, fetch, new Date(), upstreamRepo(process.env.UPDATE_SOURCE))
    if (info.manifest?.destructive) return NextResponse.json({ ok: false, message: 'This release changes existing data. Confirm it in the popup first.' }, { status: 409 })
  }

  if (body.rollback !== true && body.skipBackup !== true) {
    if (!env.D1 || !env.R2) return NextResponse.json({ ok: false, needsBackupChoice: true, message: 'No bucket for a safety backup.' }, { status: 409 })
    const backup = await runBackup({ db: env.D1, bucket: env.R2, trigger: 'manual', budgetMs: 60_000 })
    if (!backup.ok) return NextResponse.json({ ok: false, needsBackupChoice: true, message: backup.error ?? 'The safety backup did not finish.' }, { status: 409 })
  }
  const result = await pinInstallVersion(config, version)
  return NextResponse.json(result, { status: result.ok ? 200 : result.status === 'not-configured' ? 409 : 502, headers: { 'Cache-Control': 'no-store' } })
}
