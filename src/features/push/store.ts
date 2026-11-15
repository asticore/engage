import { decryptSecret, encryptSecret } from '@/features/security/twoFactor'

import { generateVapidKeys, type VapidKeys } from './webpush'

type D1 = {
  prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown>; first: <T>() => Promise<T | null> } }
}

/** The site's VAPID keys, made on first use. The private key is stored encrypted. */
export async function loadVapidKeys(d1: D1, nowIso: string): Promise<VapidKeys> {
  const row = await d1.prepare('SELECT public_key, private_key FROM eg_push_config WHERE id = 1').bind().first<{ public_key: string; private_key: string }>()
  if (row?.public_key && row.private_key) {
    const jwk = JSON.parse(await decryptSecret(row.private_key)) as JsonWebKey
    return { publicKey: row.public_key, privateJwk: jwk }
  }
  const keys = await generateVapidKeys()
  await d1
    .prepare('INSERT OR REPLACE INTO eg_push_config (id, public_key, private_key, created_at) VALUES (1, ?1, ?2, ?3)')
    .bind(keys.publicKey, await encryptSecret(JSON.stringify(keys.privateJwk)), nowIso)
    .run()
  return keys
}

export type StoredSubscription = { id: number; endpoint: string; p256dh: string; auth: string }

export async function listSubscriptions(d1: D1): Promise<StoredSubscription[]> {
  try {
    return (await d1.prepare('SELECT id, endpoint, p256dh, auth FROM eg_push_subscriptions ORDER BY id').bind().all<StoredSubscription>()).results
  } catch {
    return []
  }
}

export async function saveSubscription(d1: D1, sub: { endpoint: string; p256dh: string; auth: string }, userId: number | null, nowIso: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_push_subscriptions (endpoint, p256dh, auth, user_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id')
    .bind(sub.endpoint, sub.p256dh, sub.auth, userId, nowIso)
    .run()
}

export async function removeSubscription(d1: D1, endpoint: string): Promise<void> {
  await d1.prepare('DELETE FROM eg_push_subscriptions WHERE endpoint = ?1').bind(endpoint).run()
}
