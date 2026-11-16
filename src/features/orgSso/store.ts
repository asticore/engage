import { resolveD1Binding } from '@/cms/db/connect'
import { decryptSecret, encryptSecret } from '@/utilities/secretField'

import type { DomainClaim, SsoConnection } from './core'

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<{ meta?: { changes?: number } } | unknown> }
export type SsoD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

type Raw = {
  id: string
  org_id: string
  name: string
  issuer: string
  client_id: string
  client_secret: string | null
  domains: string | null
  default_role: string
  jit: number
  enforce: number
  enabled: number
}

const parseDomains = (text: string | null): DomainClaim[] => {
  try {
    const v = JSON.parse(text ?? '[]') as unknown
    return Array.isArray(v)
      ? v
          .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === 'object')
          .map((d) => ({ domain: String(d.domain ?? ''), token: String(d.token ?? ''), verifiedAt: d.verifiedAt ? String(d.verifiedAt) : null }))
          .filter((d) => d.domain)
      : []
  } catch {
    return []
  }
}

const toConn = (r: Raw): SsoConnection => {
  const secret = decryptSecret(r.client_secret ?? '')
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    issuer: r.issuer,
    clientId: r.client_id,
    clientSecret: typeof secret === 'string' ? secret : '',
    domains: parseDomains(r.domains),
    defaultRole: r.default_role,
    jit: Number(r.jit) === 1,
    enforce: Number(r.enforce) === 1,
    enabled: Number(r.enabled) === 1,
  }
}

const db = async (): Promise<SsoD1> => (await resolveD1Binding()) as unknown as SsoD1

export async function listConnections(d1?: SsoD1): Promise<SsoConnection[]> {
  const conn = d1 ?? (await db())
  return ((await conn.prepare('SELECT * FROM eg_org_sso ORDER BY created_at DESC').bind().all<Raw>()).results ?? []).map(toConn)
}

/** Reads never throw: the table is missing until the feature is first switched on, which means no connections. */
export async function listConnectionsSafe(d1?: SsoD1): Promise<SsoConnection[]> {
  try {
    return await listConnections(d1)
  } catch {
    return []
  }
}

export async function getConnection(id: string, d1?: SsoD1): Promise<SsoConnection | null> {
  const conn = d1 ?? (await db())
  const r = await conn.prepare('SELECT * FROM eg_org_sso WHERE id = ?1').bind(id).first<Raw>()
  return r ? toConn(r) : null
}

export async function insertConnection(c: SsoConnection, nowIso: string, d1?: SsoD1): Promise<void> {
  const conn = d1 ?? (await db())
  await conn
    .prepare('INSERT INTO eg_org_sso (id, org_id, name, issuer, client_id, client_secret, domains, default_role, jit, enforce, enabled, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)')
    .bind(c.id, c.orgId, c.name, c.issuer, c.clientId, encryptSecret(c.clientSecret), JSON.stringify(c.domains), c.defaultRole, c.jit ? 1 : 0, c.enforce ? 1 : 0, c.enabled ? 1 : 0, nowIso)
    .run()
}

export async function updateConnection(c: SsoConnection, nowIso: string, d1?: SsoD1): Promise<void> {
  const conn = d1 ?? (await db())
  await conn
    .prepare('UPDATE eg_org_sso SET name=?2, issuer=?3, client_id=?4, client_secret=?5, domains=?6, default_role=?7, jit=?8, enforce=?9, enabled=?10, updated_at=?11 WHERE id=?1')
    .bind(c.id, c.name, c.issuer, c.clientId, encryptSecret(c.clientSecret), JSON.stringify(c.domains), c.defaultRole, c.jit ? 1 : 0, c.enforce ? 1 : 0, c.enabled ? 1 : 0, nowIso)
    .run()
}

export async function deleteConnection(id: string, d1?: SsoD1): Promise<void> {
  const conn = d1 ?? (await db())
  await conn.prepare('DELETE FROM eg_org_sso_links WHERE conn_id = ?1').bind(id).run()
  await conn.prepare('DELETE FROM eg_org_sso WHERE id = ?1').bind(id).run()
}

export async function findLink(connId: string, subject: string, d1?: SsoD1): Promise<number | null> {
  const conn = d1 ?? (await db())
  const r = await conn.prepare('SELECT user_id FROM eg_org_sso_links WHERE conn_id = ?1 AND subject = ?2').bind(connId, subject).first<{ user_id: number }>()
  return r ? Number(r.user_id) : null
}

export async function insertLink(connId: string, subject: string, userId: number, nowIso: string, d1?: SsoD1): Promise<void> {
  const conn = d1 ?? (await db())
  await conn.prepare('INSERT OR IGNORE INTO eg_org_sso_links (conn_id, subject, user_id, created_at) VALUES (?1,?2,?3,?4)').bind(connId, subject, userId, nowIso).run()
}

/** Privacy erase. */
export async function eraseLinksForUser(userId: number, d1?: SsoD1): Promise<void> {
  const conn = d1 ?? (await db())
  await conn.prepare('DELETE FROM eg_org_sso_links WHERE user_id = ?1').bind(userId).run()
}
