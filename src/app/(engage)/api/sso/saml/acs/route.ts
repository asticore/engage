import { handleSamlAcs } from '@/features/orgSso/http'
import { ssoRuntime } from '@/features/orgSso/runtime'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** POST /api/sso/saml/acs: the identity provider posts the signed response here. */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).sso) return new Response('Not found', { status: 404 })
  return handleSamlAcs(request, await ssoRuntime())
}
