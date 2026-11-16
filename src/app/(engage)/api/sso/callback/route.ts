import { handleSsoCallback } from '@/features/orgSso/http'
import { ssoRuntime } from '@/features/orgSso/runtime'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** GET /api/sso/callback: where the identity provider sends the person back. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).sso) return new Response('Not found', { status: 404 })
  return handleSsoCallback(request, await ssoRuntime())
}
