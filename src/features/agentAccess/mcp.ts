import { decideRoute, forbiddenFieldIn, scopesAllow } from '@/features/apiKeys/core'

/**
 * Task 25d: a Model Context Protocol endpoint (JSON-RPC 2.0 over HTTP POST) so a connected AI tool can use the
 * site. The token is an agent token (see core.ts), so everything an agent token is held to still applies here:
 * its scopes, its daily caps and the action log. Every tool call is checked exactly like the same REST request
 * would be (`decideRoute`, `forbiddenFieldIn`) and counted through the same gate. There is no delete tool.
 */

export const PROTOCOL_VERSION = '2025-03-26'
export const MAX_FIND = 50

type Json = Record<string, unknown>
export type McpMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Json }
export type McpReply = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } } | null

export type McpEngine = {
  find(args: { collection: string; where?: unknown; limit?: number; page?: number; sort?: string }): Promise<unknown>
  findByID(args: { collection: string; id: number | string }): Promise<unknown>
  create(args: { collection: string; data: Json }): Promise<unknown>
  update(args: { collection: string; id: number | string; data: Json }): Promise<unknown>
}

export type McpDeps = {
  scopes: string[]
  /** Collections a token could ever be scoped to (secrets and users excluded). */
  collections: Array<{ slug: string; label: string }>
  /** Counts a request against the agent's caps and logs it. Returns the refusal message, or null to go ahead. */
  gate(method: 'GET' | 'POST' | 'PATCH', slug: string[]): Promise<string | null>
  engine: McpEngine
}

const ok = (id: McpMessage['id'], result: unknown): McpReply => ({ jsonrpc: '2.0', id: id ?? null, result })
const fail = (id: McpMessage['id'], code: number, message: string): McpReply => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
const text = (value: unknown, isError = false) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }], ...(isError ? { isError: true } : {}) })

const TOOLS = [
  {
    name: 'list_collections',
    description: 'List the content collections this token may read, with the slug to use in the other tools.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'find',
    description: 'Search a collection. Returns up to 50 documents per page.',
    inputSchema: {
      type: 'object',
      properties: { collection: { type: 'string' }, where: { type: 'object', description: 'Filter, for example {"slug":{"equals":"about"}}' }, limit: { type: 'integer', maximum: MAX_FIND }, page: { type: 'integer' }, sort: { type: 'string' } },
      required: ['collection'],
      additionalProperties: false,
    },
  },
  {
    name: 'get',
    description: 'Read one document by id.',
    inputSchema: { type: 'object', properties: { collection: { type: 'string' }, id: { type: ['integer', 'string'] } }, required: ['collection', 'id'], additionalProperties: false },
  },
  {
    name: 'create',
    description: 'Create a document. Needs the write scope for that collection.',
    inputSchema: { type: 'object', properties: { collection: { type: 'string' }, data: { type: 'object' } }, required: ['collection', 'data'], additionalProperties: false },
  },
  {
    name: 'update',
    description: 'Change fields of a document. Needs the write scope for that collection.',
    inputSchema: { type: 'object', properties: { collection: { type: 'string' }, id: { type: ['integer', 'string'] }, data: { type: 'object' } }, required: ['collection', 'id', 'data'], additionalProperties: false },
  },
]

const slugOf = (v: unknown): string => (typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(v) ? v : '')
const idOf = (v: unknown): number | string | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null)

async function callTool(deps: McpDeps, name: string, args: Json): Promise<ReturnType<typeof text>> {
  if (name === 'list_collections') {
    return text(deps.collections.filter((c) => scopesAllow(deps.scopes, c.slug, 'read')).map((c) => ({ slug: c.slug, label: c.label, canWrite: scopesAllow(deps.scopes, c.slug, 'write') })))
  }
  const collection = slugOf(args.collection)
  if (!collection) return text('Give a valid collection slug. Use list_collections to see them.', true)
  if (!deps.collections.some((c) => c.slug === collection)) return text(`Unknown collection "${collection}".`, true)

  const write = name === 'create' || name === 'update'
  const id = name === 'get' || name === 'update' ? idOf(args.id) : null
  if ((name === 'get' || name === 'update') && id === null) return text('Give a valid id.', true)
  const slug = id === null ? [collection] : [collection, String(id)]
  const verb = write ? (name === 'create' ? 'POST' : 'PATCH') : 'GET'
  const decision = decideRoute(deps.scopes, verb, slug)
  if (decision.ok === false) return text(decision.message, true)

  let data: Json = {}
  if (write) {
    if (!args.data || typeof args.data !== 'object' || Array.isArray(args.data)) return text('data must be an object.', true)
    data = args.data as Json
    const field = forbiddenFieldIn(data)
    if (field) return text(`API tokens cannot write the field "${field}".`, true)
  }

  const refusal = await deps.gate(verb, slug)
  if (refusal) return text(refusal, true)

  try {
    if (name === 'find') {
      const limit = Math.min(MAX_FIND, Math.max(1, Math.floor(Number(args.limit)) || 20))
      const page = Math.max(1, Math.floor(Number(args.page)) || 1)
      const where = args.where && typeof args.where === 'object' && !Array.isArray(args.where) ? args.where : undefined
      const sort = typeof args.sort === 'string' && /^-?[A-Za-z0-9_.]{1,64}$/.test(args.sort) ? args.sort : undefined
      return text(await deps.engine.find({ collection, where, limit, page, sort }))
    }
    if (name === 'get') return text(await deps.engine.findByID({ collection, id: id! }))
    if (name === 'create') return text(await deps.engine.create({ collection, data }))
    if (name === 'update') return text(await deps.engine.update({ collection, id: id!, data }))
  } catch (error) {
    return text(error instanceof Error ? error.message.slice(0, 300) : 'That did not work.', true)
  }
  return text(`Unknown tool "${name}".`, true)
}

/** Handles one JSON-RPC message. Notifications (no id) return null: the route answers 202. */
export async function handleMcp(deps: McpDeps, message: McpMessage): Promise<McpReply> {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return fail(message?.id, -32600, 'Invalid request.')
  const { id, method } = message
  const params = (message.params && typeof message.params === 'object' ? message.params : {}) as Json
  if (id === undefined) return null
  if (method === 'initialize') {
    return ok(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'engage', version: '1.0.0' }, instructions: 'Read and write this site\'s content within the limits of your token. Deleting is not possible.' })
  }
  if (method === 'ping') return ok(id, {})
  if (method === 'tools/list') return ok(id, { tools: TOOLS })
  if (method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : ''
    if (!TOOLS.some((t) => t.name === name)) return fail(id, -32602, `Unknown tool "${name}".`)
    const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Json
    return ok(id, await callTool(deps, name, args))
  }
  return fail(id, -32601, 'Method not found.')
}
