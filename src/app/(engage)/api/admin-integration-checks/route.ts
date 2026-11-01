import { NextResponse } from 'next/server'
import { getAdminContext } from '@/admin/auth'
import { checkAiKeys, checkCloudflareZone, checkGoogleKeyShape, checkPageSpeedKey, checkRecaptchaKeys } from '@/features/integrations/remoteChecks'

export const dynamic = 'force-dynamic'

/**
 * "Check connection" buttons on the Integrations page. Admins only. Each check
 * reads the SAVED settings (the buttons say so) and sends a read-only request.
 *
 * POST { check: 'ai' } - the saved Claude and OpenAI keys.
 * POST { check: 'cloudflare' } - the saved zone ID and API token.
 * POST { check: 'maps' } - the saved Google Maps key, by shape only (no call).
 * POST { check: 'pagespeed' } - the saved PageSpeed key, one call that runs no test.
 * POST { check: 'recaptcha' } - the saved reCAPTCHA site key (shape) and secret key (siteverify).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.isAdmin) return NextResponse.json({ error: 'Only an admin may check a connection.' }, { status: 403 })
    const body = (await request.json().catch((): null => null)) as { check?: unknown } | null
    if (body?.check !== 'ai' && body?.check !== 'cloudflare' && body?.check !== 'maps' && body?.check !== 'pagespeed' && body?.check !== 'recaptcha') {
      return NextResponse.json({ error: 'Choose a check to run.' }, { status: 400 })
    }
    const { getEngine } = await import('@/lib/engine')
    const engine = await getEngine()
    const integrations = (await engine.findGlobal({ slug: 'integrations', depth: 0, overrideAccess: true })) as Record<string, unknown> | null

    const google = (integrations?.google ?? {}) as { mapsApiKey?: string | null; pageSpeedApiKey?: string | null }
    const recaptcha = (integrations?.recaptcha ?? {}) as { siteKey?: string | null; secretKey?: string | null }
    const results =
      body.check === 'ai'
        ? await checkAiKeys({
            claude: (integrations?.claudeApiKey as string | null) ?? null,
            openai: (integrations?.openaiApiKey as string | null) ?? null,
          })
        : body.check === 'cloudflare'
          ? await checkCloudflareZone((integrations?.cloudflare ?? {}) as { zoneId?: string | null; apiToken?: string | null })
          : body.check === 'maps'
            ? checkGoogleKeyShape(google.mapsApiKey, 'Google Maps key')
            : body.check === 'pagespeed'
              ? await checkPageSpeedKey(google.pageSpeedApiKey)
              : await checkRecaptchaKeys(recaptcha)
    return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('admin-integration-checks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
