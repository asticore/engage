/**
 * Connect domain: attaches a registered domain to this site's Worker as a Cloudflare custom domain, through the Workers
 * custom-domains API (PUT /accounts/{account}/workers/domains). Server only.
 *
 * Needs four values from Settings > Integrations > Cloudflare: the API token (encrypted at rest, admin only), the zone ID
 * of the domain's zone, the account ID and the Worker name. Without all four, the caller shows the manual steps instead.
 * The token needs Workers Scripts (edit) and Zone (read) permissions for that account and zone. The purge-only token
 * used for cache purging is not enough for this.
 *
 * Nothing is checked beyond the API's answer: DNS propagation and certificate issue happen in Cloudflare afterwards.
 */

export type AttachSettings = { accountId: string; workerName: string; zoneId: string; apiToken: string }

export type AttachResult = { ok: true; message: string } | { ok: false; reason: 'not-configured' | 'failed'; message: string }

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** The attach settings from the integrations global, or null when any of the four is missing. Pure. */
export function attachSettingsFrom(integrations: unknown): AttachSettings | null {
  const group = (integrations as { cloudflare?: Record<string, unknown> } | null)?.cloudflare ?? {}
  const settings = {
    accountId: text(group.accountId),
    workerName: text(group.workerName),
    zoneId: text(group.zoneId),
    apiToken: text(group.apiToken),
  }
  return settings.accountId && settings.workerName && settings.zoneId && settings.apiToken ? settings : null
}

/** True when the four values are all saved. The admin uses this to show the button or the manual steps. */
export const attachConfigured = (integrations: unknown): boolean => attachSettingsFrom(integrations) !== null

/** Attaches `host` to the Worker. Returns the API's message on failure, never the token. */
export async function attachWorkerDomain(
  host: string,
  settings: AttachSettings,
  fetcher: Fetcher = fetch,
): Promise<AttachResult> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(settings.accountId)}/workers/domains`
  try {
    const response = await fetcher(url, {
      method: 'PUT',
      headers: { authorization: `Bearer ${settings.apiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ hostname: host, zone_id: settings.zoneId, service: settings.workerName, environment: 'production' }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await response.json().catch((): null => null)) as { success?: boolean; errors?: Array<{ message?: string }> } | null
    if (response.ok && body?.success !== false) {
      return { ok: true, message: `${host} is attached to the Worker.` }
    }
    const detail = body?.errors?.[0]?.message
    return { ok: false, reason: 'failed', message: detail ? `${detail} (HTTP ${response.status})` : `HTTP ${response.status}` }
  } catch {
    return { ok: false, reason: 'failed', message: 'Could not reach Cloudflare. Try again in a moment.' }
  }
}
