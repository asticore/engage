import { encryptPayload, vapidAuthorization, type VapidKeys } from './webpush'
import { isStaging } from '@/features/site/staging'
import type { StoredSubscription } from './store'

export type PushSend = { sent: number; removed: string[]; failed: number }

/**
 * Sends one notification to every stored subscription. A subscription the push service says is gone
 * (404 or 410) is reported in `removed` so the caller can delete it. Never throws.
 */
export async function pushToAll(
  subscriptions: StoredSubscription[],
  message: { title: string; body: string; url?: string },
  keys: VapidKeys,
  subject: string,
  fetcher: typeof fetch = fetch,
): Promise<PushSend> {
  const result: PushSend = { sent: 0, removed: [], failed: 0 }
  // A staging site holds copied subscriptions: nothing is pushed to real browsers from it.
  if (isStaging()) return result
  const payload = JSON.stringify({ title: message.title.slice(0, 120), body: message.body.slice(0, 400), url: message.url ?? '/' })
  for (const sub of subscriptions) {
    try {
      const body = await encryptPayload(payload, sub)
      const res = await fetcher(sub.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuthorization(sub.endpoint, keys, subject),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: '86400',
        },
        body: body as BodyInit,
      })
      if (res.ok) result.sent += 1
      else if (res.status === 404 || res.status === 410) result.removed.push(sub.endpoint)
      else result.failed += 1
    } catch {
      result.failed += 1
    }
  }
  return result
}
