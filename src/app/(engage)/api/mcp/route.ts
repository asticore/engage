import { resolveD1Binding } from '@/cms/db/connect'
import { gateAgentRequest } from '@/features/agentAccess/gate'
import { handleMcp, type McpDeps, type McpMessage, type McpReply } from '@/features/agentAccess/mcp'
import * as store from '@/features/agentAccess/store'
import { ApiKeyRefused, presentedApiKey, scopableCollections } from '@/features/apiKeys'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }
const rpcError = (status: number, code: number, message: string, extra: Record<string, string> = {}): Response =>
  Response.json({ jsonrpc: '2.0', id: null, error: { code, message } }, { status, headers: { ...headers, ...extra } })

/** POST /api/mcp: Model Context Protocol over HTTP for an agent token. Off unless AI agent access is on. */
export async function POST(request: Request): Promise<Response> {
  const flags = await getFeatureFlags()
  if (!flags.agents) return new Response('Not found', { status: 404 })
  if (!presentedApiKey(request.headers)) return rpcError(401, -32001, 'Send your agent token as a bearer token.', { 'WWW-Authenticate': 'Bearer' })

  const engine = await getEngine()
  let auth
  try {
    auth = await engine.auth({ headers: request.headers, apiKeys: true })
  } catch (error) {
    if (error instanceof ApiKeyRefused) return rpcError(error.status, -32001, error.message)
    return rpcError(500, -32603, 'Something went wrong.')
  }
  if (!auth.user || !auth.apiKey) return rpcError(401, -32001, 'API key is not valid.')

  const db = (await resolveD1Binding()) as unknown as store.D1
  const grant = await store.grantForKey(db, auth.apiKey.id).catch((): null => null)
  if (!grant) return rpcError(403, -32002, 'This endpoint is for agent tokens. Make one under AI agent access in the admin.')

  const message = (await request.json().catch((): null => null)) as McpMessage | McpMessage[] | null
  if (!message || Array.isArray(message)) return rpcError(400, -32600, 'Send one JSON-RPC message per request.')

  const user = auth.user as never
  const deps: McpDeps = {
    scopes: auth.apiKey.scopes,
    collections: scopableCollections(engine.config.collections as unknown as Array<{ slug?: unknown; labels?: { plural?: unknown } | null }>),
    async gate(method, slug) {
      const refused = await gateAgentRequest({ getD1: async () => db, featureOn: async () => true, keyId: auth.apiKey!.id, method, slug, now: Date.now() })
      if (!refused) return null
      const body = (await refused.json().catch((): null => null)) as { errors?: Array<{ message?: string }> } | null
      return body?.errors?.[0]?.message ?? 'Not allowed.'
    },
    engine: {
      find: (a) => engine.find({ collection: a.collection, where: a.where as never, limit: a.limit, page: a.page, sort: a.sort, user, overrideAccess: false }),
      findByID: (a) => engine.findByID({ collection: a.collection, id: a.id as number, user, overrideAccess: false }),
      create: (a) => engine.create({ collection: a.collection, data: a.data, user }),
      update: (a) => engine.update({ collection: a.collection, id: a.id as number, data: a.data, user }),
    },
  }
  const reply: McpReply = await handleMcp(deps, message)
  if (!reply) return new Response(null, { status: 202, headers })
  return Response.json(reply, { headers })
}

export async function GET(): Promise<Response> {
  return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'POST' } })
}
