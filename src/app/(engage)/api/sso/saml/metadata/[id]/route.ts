import { handleSamlMetadata } from '@/features/orgSso/http'
import { ssoRuntime } from '@/features/orgSso/runtime'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/** GET /api/sso/saml/metadata/<id>: service provider metadata to give the identity provider. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await getFeatureFlags()).sso) return new Response('Not found', { status: 404 })
  const { id } = await ctx.params
  return handleSamlMetadata(request, id, await ssoRuntime())
}
