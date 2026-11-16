/**
 * Task 22h: the signed-in customer's ID for Google Analytics 4 (`user_id`). Off by default and consent gated by the
 * analytics loader. With hashing on (the default when it is switched on) GA4 gets a keyed hash, never the raw ID,
 * so it cannot be matched to an account without the site's secret.
 */

const toHex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function ga4UserId(userId: number | string | null | undefined, options: { hash: boolean; secret: string }): Promise<string | undefined> {
  const raw = userId === null || userId === undefined ? '' : String(userId).trim()
  if (!raw || raw.length > 64) return undefined
  if (!options.hash) return raw
  if (!options.secret) return undefined
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(options.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`ga4-user:${raw}`))).slice(0, 32)
}

/** The gtag config call: with a user ID it carries `user_id`. Values are JSON encoded for a script tag. */
export const gtagConfigScript = (measurementId: string, userId?: string): string =>
  `gtag('config',${JSON.stringify(measurementId)}${userId ? `,{user_id:${JSON.stringify(userId)}}` : ''});`
