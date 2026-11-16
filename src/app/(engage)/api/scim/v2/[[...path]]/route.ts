import { defaultOrgStore } from '@/features/organizations/store'
import { placeholderPassword } from '@/features/socialLogin/passwords'
import { publicOrigin } from '@/features/google/origin'
import { defaultUserSessionStore } from '@/features/security/userSessionStore'
import { revokeQuietly } from '@/features/security/userSessions'
import { tokenShape, scimError } from '@/features/scim/core'
import { handleScim, type ScimDeps } from '@/features/scim/handler'
import * as store from '@/features/scim/store'
import { hit } from '@/features/security/rateLimit'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const CT = { 'Content-Type': 'application/scim+json', 'Cache-Control': 'no-store' }
const reply = (status: number, body?: unknown): Response => (body === undefined ? new Response(null, { status, headers: CT }) : new Response(JSON.stringify(body), { status, headers: CT }))

type UserDoc = { id: number | string; email?: string; roles?: unknown; displayName?: string }
const lite = (doc: UserDoc | null | undefined) => {
  if (!doc) return null
  const display = String(doc.displayName ?? '')
  const [first, ...rest] = display.split(' ')
  return { id: Number(doc.id), email: String(doc.email ?? ''), roles: Array.isArray(doc.roles) ? (doc.roles as string[]) : [], firstName: first ?? '', lastName: rest.join(' ') }
}

async function handle(request: Request, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  // Without Single sign-on switched on, the endpoint does not exist. It is part of that feature.
  if (!(await getFeatureFlags()).sso) return reply(404, scimError(404, 'Not found.').body)
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const address = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (hit(`scim:${token ? token.slice(0, 12) : address}`, 300).limited) return reply(429, scimError(429, 'Too many requests.').body)
  if (!tokenShape(token)) return reply(401, scimError(401, 'A valid bearer token is required.').body)
  const orgId = await store.orgForToken(token).catch((): null => null)
  if (!orgId) return reply(401, scimError(401, 'A valid bearer token is required.').body)
  void store.touchToken(orgId, new Date().toISOString()).catch((): void => undefined)

  const engine = await getEngine()
  const secret = process.env.ENGAGE_SECRET || ''
  const deps: ScimDeps = {
    org: defaultOrgStore,
    links: store.createLinkStore(),
    findUserByID: async (id) => lite((await engine.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch((): null => null)) as UserDoc | null),
    findUserByEmail: async (email) => lite((await engine.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as UserDoc | undefined),
    createCustomer: async (email, given, family) => {
      const created = (await engine.create({
        collection: 'users',
        data: { email, password: placeholderPassword(secret, email), roles: ['customer'], emailVerifiedAt: new Date().toISOString(), ...(given || family ? { displayName: `${given} ${family}`.trim() } : {}) },
        overrideAccess: true,
      })) as { id: number | string }
      return Number(created.id)
    },
    endSessions: (userId) => revokeQuietly(defaultUserSessionStore, userId, null),
    defaultRole: 'member',
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
  }
  const { path } = await ctx.params
  const url = new URL(request.url)
  const body = request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' ? await request.json().catch((): null => null) : null
  const result = await handleScim(deps, { orgId, base: `${publicOrigin(request.url)}/api/scim/v2`, method: request.method.toUpperCase(), path: path ?? [], params: url.searchParams, body })
  return reply(result.status, result.body)
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE }
