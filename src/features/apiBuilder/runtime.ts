import { forbiddenFieldIn, presentedApiKey, scopesAllow, ApiKeyRefused, type ApiKeyContext, type ApiKeyScope } from '@/features/apiKeys'
import { isStaffRoles } from '@/features/apiKeys/core'
import { hitShared } from '@/features/security/rateLimit'
import { audit, auditContext } from '@/features/security/auditLog'
import { getSecuritySettings } from '@/features/security/settings'
import { resolveAccess } from '@/features/roles/permissions'
import { loadStrings, type UiDictionary } from '@/features/uiStrings'
import { loadFieldGroups, locationContextFor } from '@/features/customFields/server'
import { CALL_LOG_RETENTION_MS, createD1EndpointStore, type EndpointStore } from './store'
import { isGuideFormat, renderGuide, sameToken, siteNameFor } from './guideResponse'
import { readCustomValues, customWriteValues, type CustomDeps } from './customValues'
import { englishOf, problem, requestedLocale, textFor, type ApiProblem } from './messages'
import {
  ENDPOINT_BASE,
  TRASHABLE_COLLECTIONS,
  firstUnwritableKey,
  isCustomKey,
  parseEndpointQuery,
  projectDocument,
  type ApiEndpoint,
  type RequiredRole,
} from './core'

/**
 * Serves the custom endpoints under /api/x/<version>/<name>. Authentication is the
 * existing API key system: `engine.auth({ apiKeys: true })` reads the key, checks it is
 * live and not expired, and reads the owner's live roles. This module then applies the
 * endpoint's own rules on top of the key's scopes: the key list, the owner's role, the
 * method switches, the field whitelist, custom fields, delete and the rate limit.
 * Nothing here is a second auth.
 *
 * Returns null for any path that is not under `x`, so the normal REST dispatch carries on.
 * Messages are held in uiStrings and answered in the caller's Accept-Language (English by default).
 */

export type EndpointEngine = {
  findGlobal?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  auth: (args: { headers: Headers; apiKeys?: boolean }) => Promise<{ user: unknown; apiKey?: ApiKeyContext }>
  find: (args: Record<string, unknown>) => Promise<{ docs: Record<string, unknown>[]; totalDocs?: number; hasNextPage?: boolean; page?: number; totalPages?: number }>
  findByID: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  delete: (args: Record<string, unknown>) => Promise<unknown>
}

/** One DELETE, for the audit log. The API key and the body are never written. */
export type DeleteAudit = {
  endpointName: string
  endpointPath: string
  collection: string
  documentId: number
  keyId: number
  actorId: number | null
  actorEmail: string | null
  mode: 'trash' | 'deleted'
}

export type EndpointRuntimeDeps = {
  engine: EndpointEngine
  store: EndpointStore
  now: () => number
  /** Counts one request for this key on this endpoint. Returns whether it is over the limit. */
  rateLimit: (key: string, perMinute: number) => Promise<{ limited: boolean; retryAfterSeconds: number }>
  /** Whether the key's owner holds delete permission for the collection. Denied unless the wiring says yes. */
  canDelete: (user: unknown, collection: string) => boolean
  /** Writes one audit line per DELETE. */
  audit?: (entry: DeleteAudit, request: Request) => Promise<void>
  /** Custom field groups and the record location rules. Only used by endpoints that expose a custom field. */
  customs?: CustomDeps
  /** Whether to run the occasional log prune. Tests pass false. */
  prune?: boolean
}

export type EndpointDecision = { ok: true } | { ok: false; status: 401 | 403 | 405; name: string; message: string; problem: ApiProblem }

const ROLE_RULES: Record<RequiredRole, (roles: readonly string[]) => boolean> = {
  any: () => true,
  staff: (roles) => isStaffRoles(roles),
  editor: (roles) => roles.includes('admin') || roles.includes('editor'),
  admin: (roles) => roles.includes('admin'),
}

/**
 * Pure: may this key, held by this owner, make this request to this endpoint? Checked in order:
 * enabled, method switch, key list, owner role, key scope for the collection. DELETE is a write
 * on the collection's write scope; whether the owner may delete is checked by the runtime.
 */
export function decideEndpointAccess(input: {
  endpoint: Pick<ApiEndpoint, 'enabled' | 'collection' | 'allowCreate' | 'allowUpdate' | 'allowDelete' | 'allowedKeyIds' | 'requiredRole'>
  method: string
  keyId: number
  keyScopes: readonly ApiKeyScope[]
  roles: readonly string[]
}): EndpointDecision {
  const { endpoint, method, keyId } = input
  const verb = method.toUpperCase()
  const deny = (status: 403 | 405, name: string, p: ApiProblem): EndpointDecision => ({ ok: false, status, name, message: englishOf(p), problem: p })
  if (!endpoint.enabled) return deny(403, 'Forbidden', problem('api.endpoint.off'))
  let action: 'read' | 'write'
  if (verb === 'GET' || verb === 'HEAD') action = 'read'
  else if (verb === 'POST') {
    if (!endpoint.allowCreate) return deny(405, 'MethodNotAllowed', problem('api.method.postOff'))
    action = 'write'
  } else if (verb === 'PATCH') {
    if (!endpoint.allowUpdate) return deny(405, 'MethodNotAllowed', problem('api.method.patchOff'))
    action = 'write'
  } else if (verb === 'DELETE') {
    if (!endpoint.allowDelete) return deny(405, 'MethodNotAllowed', problem('api.method.deleteOff'))
    action = 'write'
  } else {
    return deny(405, 'MethodNotAllowed', problem('api.method.notAllowed'))
  }
  if (endpoint.allowedKeyIds && !endpoint.allowedKeyIds.includes(keyId)) {
    return deny(403, 'Forbidden', problem('api.key.notAllowed'))
  }
  if (!ROLE_RULES[endpoint.requiredRole](input.roles)) {
    return deny(403, 'Forbidden', problem('api.owner.roleNeeded'))
  }
  if (!scopesAllow(input.keyScopes, endpoint.collection, action)) {
    return deny(403, 'Forbidden', problem('api.key.scopeNeeded', { scope: `${endpoint.collection}:${action === 'read' ? 'read' : 'write'}` }))
  }
  return { ok: true }
}

const json = (body: unknown, status: number, headers?: Record<string, string>): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

const refusal = (status: number, name: string, message: string, headers?: Record<string, string>): Response =>
  json({ errors: [{ name, message }] }, status, headers)

/**
 * Parses the path after `/api/`. `x/v1/name` or `x/v1/name/42`. Null when the shape is wrong.
 */
export function parseEndpointRoute(slug: readonly string[]): { version: string; name: string; id: number | null } | null {
  if (slug[0] !== ENDPOINT_BASE) return null
  if (slug.length !== 3 && slug.length !== 4) return null
  let id: number | null = null
  if (slug.length === 4) {
    const n = Number(slug[3])
    if (!Number.isInteger(n) || n < 1) return null
    id = n
  }
  return { version: slug[1], name: slug[2], id }
}

/** A D1-style or hook validation failure: one entry per failing field, shaped like the other error bodies. */
function validationErrors(err: unknown): Array<{ path?: string; message: string }> | null {
  const e = err as { name?: unknown; errors?: unknown } | null
  if (!e || e.name !== 'ValidationError' || !Array.isArray(e.errors)) return null
  return e.errors
    .filter((item): item is { path?: string; message: string } => Boolean(item) && typeof (item as { message?: unknown }).message === 'string')
    .map((item) => ({ path: item.path, message: item.message }))
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export async function serveCustomEndpoint(request: Request, slug: readonly string[], deps: EndpointRuntimeDeps): Promise<Response | null> {
  const route = parseEndpointRoute(slug)
  if (!route) return slug[0] === ENDPOINT_BASE ? refusal(404, 'NotFound', 'Route not found.') : null

  const dict = (await loadStrings(requestedLocale(request.headers.get('accept-language'))).catch((): null => null)) as Partial<UiDictionary> | null
  const say = (p: ApiProblem): string => textFor(p, dict)

  const endpoint = await deps.store.findByPath(route.version, route.name)
  if (!endpoint || !endpoint.enabled) return refusal(404, 'NotFound', say(problem('api.route.notFound')))

  const method = request.method.toUpperCase()
  const started = deps.now()
  const finish = async (response: Response, keyId: number | null, userId: number | null): Promise<Response> => {
    const createdAt = new Date(started).toISOString()
    await deps.store.logCall({ endpointId: endpoint.id, keyId, userId, method, status: response.status, createdAt }).catch((): void => undefined)
    if (deps.prune !== false && Math.random() < 0.02) {
      await deps.store.pruneLog(new Date(started - CALL_LOG_RETENTION_MS).toISOString()).catch((): void => undefined)
    }
    return response
  }

  if (!['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'].includes(method)) return finish(refusal(405, 'MethodNotAllowed', say(problem('api.method.notAllowed'))), null, null)
  if (!presentedApiKey(request.headers)) return finish(refusal(401, 'ApiKeyRefused', say(problem('api.key.missing'))), null, null)

  let user: unknown
  let key: ApiKeyContext | undefined
  try {
    ;({ user, apiKey: key } = await deps.engine.auth({ headers: request.headers, apiKeys: true }))
  } catch (err) {
    if (err instanceof ApiKeyRefused) return finish(refusal(err.status, 'ApiKeyRefused', err.message), null, null)
    return finish(refusal(500, 'Error', say(problem('api.error.generic'))), null, null)
  }
  if (!key) return finish(refusal(401, 'ApiKeyRefused', say(problem('api.key.invalid'))), null, null)
  const owner = user as { id?: number; email?: string; roles?: string[] } | null
  const roles = owner?.roles ?? []
  const userId = typeof owner?.id === 'number' ? owner.id : key.userId

  const decision = decideEndpointAccess({ endpoint, method, keyId: key.id, keyScopes: key.scopes, roles })
  if (decision.ok === false) return finish(refusal(decision.status, decision.name, say(decision.problem)), key.id, userId)

  const limit = await deps.rateLimit(`api-endpoint:${endpoint.id}:${key.id}`, endpoint.rateLimitPerMinute)
  if (limit.limited) {
    return finish(refusal(429, 'RateLimited', say(problem('api.rate.limited')), { 'Retry-After': String(limit.retryAfterSeconds) }), key.id, userId)
  }

  const collection = endpoint.collection
  const access = { user, overrideAccess: false, depth: 0 }
  const customs: CustomDeps = deps.customs ?? { loadGroups: async () => [], locate: (c, _doc, r) => ({ collection: c, status: null, userRoles: [...r] }) }
  const hasCustom = endpoint.fields.some(isCustomKey)
  /** A record as the caller sees it: the exposed built-in fields, and the custom values this account may read. */
  const shape = async (doc: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const visible = hasCustom ? await readCustomValues(customs, collection, doc, roles) : {}
    return projectDocument(doc, endpoint.fields, visible)
  }

  try {
    if (method === 'GET' || method === 'HEAD') {
      if (route.id !== null) {
        const doc = await deps.engine.findByID({ ...access, collection, id: route.id })
        if (!doc) return finish(refusal(404, 'NotFound', say(problem('api.record.notFound'))), key.id, userId)
        return finish(json({ data: await shape(doc) }, 200), key.id, userId)
      }
      const parsed = parseEndpointQuery(endpoint, new URL(request.url).searchParams)
      if (parsed.ok === false) return finish(refusal(400, 'BadRequest', say(parsed.problem)), key.id, userId)
      const q = parsed.value
      const result = await deps.engine.find({
        ...access,
        collection,
        where: Object.keys(q.where).length ? q.where : undefined,
        sort: q.sort,
        limit: q.limit,
        page: q.page,
        pagination: true,
      })
      const data = await Promise.all(result.docs.map(shape))
      if (endpoint.responseFormat === 'array') return finish(json(data, 200), key.id, userId)
      return finish(
        json({ data, page: result.page ?? q.page, limit: q.limit, totalDocs: result.totalDocs ?? null, totalPages: result.totalPages ?? null, hasNextPage: result.hasNextPage ?? false }, 200),
        key.id,
        userId,
      )
    }

    if (method === 'DELETE') {
      if (route.id === null) return finish(refusal(404, 'NotFound', say(problem('api.route.notFound'))), key.id, userId)
      if (!deps.canDelete(user, collection)) return finish(refusal(403, 'Forbidden', say(problem('api.delete.noPermission'))), key.id, userId)
      const current = await deps.engine.findByID({ ...access, collection, id: route.id })
      if (!current) return finish(refusal(404, 'NotFound', say(problem('api.record.notFound'))), key.id, userId)
      let mode: 'trash' | 'deleted'
      if (TRASHABLE_COLLECTIONS.has(collection)) {
        // Trash first: the same record moves to the trash, as the admin's Move to trash does.
        mode = 'trash'
        if (!current.trashedAt) {
          const trashed = await deps.engine.update({ ...access, collection, id: route.id, data: { trashedAt: new Date(started).toISOString(), _status: 'draft' } })
          // The trash guard keeps the stored value when the owner may not delete; that is a refusal here.
          if (!trashed || !trashed.trashedAt) return finish(refusal(403, 'Forbidden', say(problem('api.delete.noPermission'))), key.id, userId)
        }
      } else {
        mode = 'deleted'
        await deps.engine.delete({ ...access, collection, id: route.id })
      }
      if (deps.audit) {
        await deps
          .audit(
            { endpointName: endpoint.name, endpointPath: `/api/${ENDPOINT_BASE}/${endpoint.version}/${endpoint.slug}`, collection, documentId: route.id, keyId: key.id, actorId: userId, actorEmail: owner?.email ?? null, mode },
            request,
          )
          .catch((): void => undefined)
      }
      return finish(json({ data: { id: route.id, deleted: true, mode } }, 200), key.id, userId)
    }

    // POST and PATCH: a JSON object, made of exposed fields only.
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    if (!isObject(body)) return finish(refusal(400, 'BadRequest', say(problem('api.body.notObject'))), key.id, userId)
    const badKey = firstUnwritableKey(body, endpoint.fields)
    if (badKey) return finish(refusal(403, 'Forbidden', say(problem('api.body.fieldNotWritable', { field: badKey }))), key.id, userId)
    const secret = forbiddenFieldIn(body)
    if (secret) return finish(refusal(403, 'Forbidden', say(problem('api.body.secretNotWritable', { field: secret }))), key.id, userId)

    if (method === 'POST' && route.id !== null) return finish(refusal(404, 'NotFound', say(problem('api.route.notFound'))), key.id, userId)
    if (method === 'PATCH' && route.id === null) return finish(refusal(404, 'NotFound', say(problem('api.route.notFound'))), key.id, userId)

    // Built-in fields go to the engine as they are. Custom fields are gathered into the `customFields` value,
    // which the collection's own save hook checks against the field groups (required, types, ranges).
    const plain: Record<string, unknown> = {}
    const customInBody: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) {
      if (isCustomKey(k)) customInBody[k] = v
      else plain[k] = v
    }
    const data: Record<string, unknown> = { ...plain }
    if (Object.keys(customInBody).length > 0) {
      // A custom field update merges into the record's stored values, so the record is read first.
      const existing = method === 'PATCH' ? await deps.engine.findByID({ ...access, collection, id: route.id! }) : null
      if (method === 'PATCH' && !existing) return finish(refusal(404, 'NotFound', say(problem('api.record.notFound'))), key.id, userId)
      const written = await customWriteValues(customs, collection, existing ?? plain, roles, customInBody)
      if (written.ok === false) return finish(refusal(403, 'Forbidden', say(problem('api.cf.notAvailable', { field: written.field }))), key.id, userId)
      const stored = existing && isObject(existing.customFields) ? existing.customFields : {}
      data.customFields = { ...stored, ...written.values }
    }

    if (method === 'POST') {
      const created = await deps.engine.create({ ...access, collection, data })
      return finish(json({ data: await shape(created) }, 201), key.id, userId)
    }
    const updated = await deps.engine.update({ ...access, collection, id: route.id!, data })
    if (!updated) return finish(refusal(404, 'NotFound', say(problem('api.record.notFound'))), key.id, userId)
    return finish(json({ data: await shape(updated) }, 200), key.id, userId)
  } catch (err) {
    const fields = validationErrors(err)
    if (fields) return finish(json({ errors: fields.map((f) => ({ name: 'ValidationError', message: f.message, ...(f.path ? { path: f.path } : {}) })) }, 400), key.id, userId)
    return finish(refusal(500, 'Error', say(problem('api.error.generic'))), key.id, userId)
  }
}

/**
 * The public developer guide: /api/x/docs/<token>. Served only while the admin has switched the public
 * link on, and only with the current token. Anything else is the same 404 as an unknown endpoint.
 * Every response is noindex (also set by the middleware for /api).
 */
export async function serveDocs(request: Request, slug: readonly string[], store: EndpointStore, siteName: () => Promise<string>): Promise<Response> {
  const notFound = Response.json({ errors: [{ name: 'NotFound', message: 'Route not found.' }] }, { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } })
  if (slug.length !== 3) return notFound
  const docs = await store.docsSettings()
  if (!docs.docsPublic || !sameToken(slug[2], docs.docsToken)) return notFound
  const format = new URL(request.url).searchParams.get('format')
  const endpoints = await store.list()
  return renderGuide(
    isGuideFormat(format) ? format : 'guide.html',
    endpoints,
    { baseUrl: new URL(request.url).origin, siteName: await siteName(), generatedAt: new Date().toISOString().slice(0, 10) },
    'page',
  )
}

/** The production wiring: D1 store, shared rate limit, the engine from the REST dispatcher, audit, custom fields. */
export async function handleCustomApiEndpoint(request: Request, slug: readonly string[], engine: EndpointEngine, resolveDb: () => Promise<unknown>): Promise<Response | null> {
  if (slug[0] !== ENDPOINT_BASE) return null
  const store = createD1EndpointStore(async () => (await resolveDb()) as never)
  if (slug[1] === 'docs') return serveDocs(request, slug, store, () => siteNameFor(engine))
  return serveCustomEndpoint(request, slug, {
    engine,
    store,
    now: () => Date.now(),
    rateLimit: async (key, perMinute) => {
      const decision = await hitShared(key, perMinute)
      return { limited: decision.limited, retryAfterSeconds: decision.retryAfterSeconds }
    },
    canDelete: (user, collection) => resolveAccess(user as never, collection as never, 'delete') === 'all',
    audit: async (entry, req) => {
      const settings = await getSecuritySettings(engine as never)
      await audit(
        {
          action: 'delete',
          actorId: entry.actorId,
          actorEmail: entry.actorEmail,
          collectionSlug: entry.collection,
          documentId: entry.documentId,
          detail: `API ${entry.endpointPath} (${entry.endpointName}), key ${entry.keyId}, ${entry.mode === 'trash' ? 'moved to trash' : 'deleted'}`.slice(0, 200),
          ...auditContext(req),
        },
        settings,
      )
    },
    customs: { loadGroups: loadFieldGroups, locate: (collection, doc, roles) => locationContextFor(collection, doc, [...roles]) },
  })
}
