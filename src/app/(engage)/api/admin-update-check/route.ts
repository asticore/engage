import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import pkg from '../../../../../package.json'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { checkForUpdate, type UpdateCheck } from '@/features/updates/check'
import { readConnection } from '@/features/updates/connection'
import { isLeanInstall } from '@/features/updates/oneClick'
import { upstreamRepo } from '@/features/updates/versions'

type Answer = UpdateCheck & { oneClick: boolean; lean: boolean }
/**
 * A site deployed straight from the upstream repository (not a lean install, not a fork) gets every release on its next deploy,
 * so there is nothing for its admin to do and the Worker-update popup must never show. Its own version number lags the tags, which
 * is why "newer release exists" cannot be trusted there.
 */
const selfUpdating = (links: { sameRepo: boolean }): boolean => !isLeanInstall(process.env.ENGAGE_INSTALL) && links.sameRepo
/** True when the site holds a GitHub connection (Worker settings or the one saved from the popup), so Update now can run. */
const oneClickOn = async (): Promise<boolean> => {
  const { env } = await getCloudflareContext({ async: true })
  return Boolean(await readConnection(env.D1, process.env.UPDATE_REPO, process.env.UPDATE_GITHUB_TOKEN))
}

export const dynamic = 'force-dynamic'

/** One answer is kept for six hours per Worker, so opening the admin does not call GitHub each time. */
const TTL_MS = 6 * 60 * 60 * 1000
let cached: { at: number; value: Answer } | null = null

/**
 * GET /api/admin-update-check: is a newer Engage released? Super admins only (an admin is the top role), others get 403 so the
 * popup never shows for them. Add `?refresh=1` to skip the kept answer. Set UPDATE_REPO (owner/name) on a fork to point Update at the fork.
 */
export async function GET(request: Request): Promise<Response> {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const refresh = new URL(request.url).searchParams.get('refresh') === '1'
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) return NextResponse.json({ ...cached.value, oneClick: await oneClickOn() }, { headers: { 'Cache-Control': 'no-store' } })
  const value = await checkForUpdate(pkg.version, process.env.UPDATE_REPO, fetch, new Date(), upstreamRepo(process.env.UPDATE_SOURCE))
  const answer: Answer = { ...value, oneClick: await oneClickOn(), lean: isLeanInstall(process.env.ENGAGE_INSTALL) }
  if (selfUpdating(value.links)) answer.updateAvailable = false
  if (!value.error) cached = { at: Date.now(), value: answer }
  return NextResponse.json(answer, { headers: { 'Cache-Control': 'no-store' } })
}
