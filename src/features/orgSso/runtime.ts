import { defaultOrgStore } from '@/features/organizations/store'
import { defaultRuntime } from '@/features/socialLogin/runtime'
import { placeholderPassword } from '@/features/socialLogin/passwords'
import { getEngine } from '@/lib/engine'

import type { SsoRuntime } from './http'
import type { SsoUser } from './service'
import * as store from './store'

type UserDoc = { id: number | string; email?: string; roles?: unknown }
const toUser = (doc: UserDoc | null | undefined): SsoUser | null =>
  doc ? { id: Number(doc.id), email: String(doc.email ?? ''), roles: Array.isArray(doc.roles) ? (doc.roles as string[]) : [] } : null

/** The real wiring for the public routes. Server only. */
export async function ssoRuntime(): Promise<SsoRuntime> {
  const engine = await getEngine()
  const base = await defaultRuntime()
  const secret = process.env.ENGAGE_SECRET || ''
  const now = (): string => new Date().toISOString()
  return {
    secret: base.secret,
    fetchImpl: base.fetchImpl,
    now: base.now,
    origin: base.origin,
    login: base.login,
    audit: base.audit,
    limited: base.limited,
    sessionCookie: base.sessionCookie,
    listConnections: () => store.listConnectionsSafe(),
    getConnection: (id) => store.getConnection(id).catch((): null => null),
    deps: {
      findLink: (connId, subject) => store.findLink(connId, subject),
      insertLink: (connId, subject, userId) => store.insertLink(connId, subject, userId, now()),
      async findUserByID(id) {
        return toUser((await engine.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch((): null => null)) as UserDoc | null)
      },
      async findUserByEmail(email) {
        const found = await engine.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
        return toUser(found.docs[0] as UserDoc | undefined)
      },
      async createCustomer(email) {
        const created = (await engine.create({
          collection: 'users',
          data: { email, password: placeholderPassword(secret, email), roles: ['customer'], emailVerifiedAt: now() },
          overrideAccess: true,
        })) as { id: number | string }
        return Number(created.id)
      },
      async ensureMember(orgId, userId, role) {
        await defaultOrgStore.insertMember({ id: crypto.randomUUID(), organizationId: orgId, userId, role, createdAt: now() })
      },
    },
  }
}
