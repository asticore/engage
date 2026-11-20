import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { adminRequestRefusal } from '@/features/forms/origin'
import { ASSET_PRESETS, SHINE_CSS_URL, SHINE_VERSION, SPARK_BASE_URL, SPARK_VERSION } from '@/features/frontendAssets/builtin'
import { normaliseAssets, validateAssets } from '@/features/frontendAssets/config'
import { saveFrontendAssets } from '@/features/frontendAssets/save'
import { readFrontendAssets, resetFrontendAssetsCache } from '@/features/frontendAssets/store'
import { audit, auditContext } from '@/features/security/auditLog'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can change the front-end files.' }, 403) }
  return { context }
}

/** GET: the saved list, the presets, and where Shine and Spark come from. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  resetFrontendAssetsCache()
  const config = await readFrontendAssets()
  return json({ config, presets: ASSET_PRESETS, builtin: { shine: { version: SHINE_VERSION, url: SHINE_CSS_URL }, spark: { version: SPARK_VERSION, url: SPARK_BASE_URL } } })
}

/** POST { assets: [...] }: replaces the whole list. */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const problem = validateAssets(body)
  if (problem) return json({ error: problem }, 400)
  const config = normaliseAssets(body)
  await saveFrontendAssets(config)
  void audit({ action: 'frontend-assets.save', detail: `${config.assets.length} files: ${config.assets.map((a) => new URL(a.url).host).join(', ')}`.slice(0, 500), ...auditContext(request) }, await readSecuritySettingsFromD1())
  return json({ ok: true, config })
}
