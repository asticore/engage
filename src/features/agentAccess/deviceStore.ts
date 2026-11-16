import { resolveD1Binding } from '@/cms/db/connect'
import { decryptSecret, encryptSecret } from '@/utilities/secretField'

import { DEVICE_TTL_MS, POLL_INTERVAL_S, type DeviceRow, type DeviceStatus } from './device'

/** Pending device codes. Created on first use (only reached when AI agent access is on), so no migration. Only the hash of the device code is stored. */

type Statement = { first<T>(): Promise<T | null>; all<T>(): Promise<{ results?: T[] }>; run(): Promise<{ meta?: { changes?: number } } | unknown> }
export type DeviceD1 = { prepare(sql: string): { bind(...values: unknown[]): Statement } }

const CREATE = [
  'CREATE TABLE IF NOT EXISTS eg_device_codes (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, device_hash TEXT NOT NULL, user_code TEXT NOT NULL, client_name TEXT NOT NULL, scope TEXT NOT NULL DEFAULT \'read\', status TEXT NOT NULL DEFAULT \'pending\', token_enc TEXT, expires_at INTEGER NOT NULL, last_poll_at INTEGER NOT NULL DEFAULT 0, poll_interval INTEGER NOT NULL DEFAULT 5, created_at TEXT)',
  'CREATE UNIQUE INDEX IF NOT EXISTS eg_device_codes_hash_idx ON eg_device_codes (device_hash)',
  'CREATE INDEX IF NOT EXISTS eg_device_codes_user_idx ON eg_device_codes (user_code)',
]
let ensured: Promise<void> | null = null
export async function deviceDb(): Promise<DeviceD1> {
  const d1 = (await resolveD1Binding()) as unknown as DeviceD1
  if (!ensured) {
    ensured = (async () => {
      for (const s of CREATE) await d1.prepare(s).bind().run()
    })().catch((error: unknown): never => {
      ensured = null
      throw error
    })
  }
  await ensured
  return d1
}

type Raw = { id: number; user_code: string; client_name: string; scope: string; status: string; token_enc: string | null; expires_at: number; last_poll_at: number; poll_interval: number }
const toRow = (r: Raw): DeviceRow => ({
  id: Number(r.id),
  userCode: r.user_code,
  clientName: r.client_name,
  scope: r.scope === 'write' ? 'write' : 'read',
  status: (['pending', 'approved', 'denied', 'used'].includes(r.status) ? r.status : 'denied') as DeviceStatus,
  tokenEnc: r.token_enc,
  expiresAt: Number(r.expires_at),
  lastPollAt: Number(r.last_poll_at),
  interval: Number(r.poll_interval) || POLL_INTERVAL_S,
})

export async function countPending(d1: DeviceD1, now: number): Promise<number> {
  const r = await d1.prepare("SELECT COUNT(*) AS n FROM eg_device_codes WHERE status = 'pending' AND expires_at > ?1").bind(now).first<{ n: number }>()
  return Number(r?.n ?? 0)
}

export async function insertDevice(d1: DeviceD1, a: { deviceHash: string; userCode: string; clientName: string; scope: 'read' | 'write' }, now: number): Promise<void> {
  // Old rows go with every new request, so the table stays small.
  await d1.prepare('DELETE FROM eg_device_codes WHERE expires_at < ?1').bind(now - 3_600_000).run()
  await d1
    .prepare('INSERT INTO eg_device_codes (device_hash, user_code, client_name, scope, status, expires_at, last_poll_at, poll_interval, created_at) VALUES (?1,?2,?3,?4,\'pending\',?5,0,?6,?7)')
    .bind(a.deviceHash, a.userCode, a.clientName, a.scope, now + DEVICE_TTL_MS, POLL_INTERVAL_S, new Date(now).toISOString())
    .run()
}

export async function findByHash(d1: DeviceD1, hash: string): Promise<DeviceRow | null> {
  const r = await d1.prepare('SELECT * FROM eg_device_codes WHERE device_hash = ?1').bind(hash).first<Raw>()
  return r ? toRow(r) : null
}

export async function findPendingByUserCode(d1: DeviceD1, userCode: string, now: number): Promise<DeviceRow | null> {
  const r = await d1.prepare("SELECT * FROM eg_device_codes WHERE user_code = ?1 AND status = 'pending' AND expires_at > ?2 ORDER BY id DESC LIMIT 1").bind(userCode, now).first<Raw>()
  return r ? toRow(r) : null
}

export async function notePoll(d1: DeviceD1, id: number, now: number, interval: number): Promise<void> {
  await d1.prepare('UPDATE eg_device_codes SET last_poll_at = ?2, poll_interval = ?3 WHERE id = ?1').bind(id, now, interval).run()
}

/** Approves only a row that is still pending. False when someone else got there first. */
export async function approve(d1: DeviceD1, id: number, token: string): Promise<boolean> {
  const res = (await d1.prepare("UPDATE eg_device_codes SET status = 'approved', token_enc = ?2 WHERE id = ?1 AND status = 'pending'").bind(id, encryptSecret(token)).run()) as { meta?: { changes?: number } }
  return Number(res?.meta?.changes ?? 0) > 0
}

export async function deny(d1: DeviceD1, id: number): Promise<void> {
  await d1.prepare("UPDATE eg_device_codes SET status = 'denied' WHERE id = ?1 AND status = 'pending'").bind(id).run()
}

/** Hands the token over exactly once: the row flips to used and the token is wiped in the same statement. Null when already taken. */
export async function takeToken(d1: DeviceD1, row: DeviceRow): Promise<string | null> {
  const res = (await d1.prepare("UPDATE eg_device_codes SET status = 'used', token_enc = NULL WHERE id = ?1 AND status = 'approved'").bind(row.id).run()) as { meta?: { changes?: number } }
  if (Number(res?.meta?.changes ?? 0) < 1) return null
  const plain = decryptSecret(row.tokenEnc ?? '')
  return typeof plain === 'string' && plain ? plain : null
}

/** Requests waiting for an admin, newest first. The device code itself is never listed (only its hash is stored). */
export async function listPending(d1: DeviceD1, now: number): Promise<Array<{ userCode: string; clientName: string; scope: 'read' | 'write'; expiresAt: number }>> {
  const rows = (await d1.prepare("SELECT * FROM eg_device_codes WHERE status = 'pending' AND expires_at > ?1 ORDER BY id DESC LIMIT 20").bind(now).all<Raw>()).results ?? []
  return rows.map(toRow).map((r) => ({ userCode: r.userCode, clientName: r.clientName, scope: r.scope, expiresAt: r.expiresAt }))
}
