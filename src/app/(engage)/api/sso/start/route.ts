import { handleSsoStart } from '@/features/orgSso/http'
import { ssoRuntime } from '@/features/orgSso/runtime'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** GET /api/sso/start: single sign-on by work email. 404 when the feature is off. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).sso) return new Response('Not found', { status: 404 })
  return handleSsoStart(request, await ssoRuntime())
}
