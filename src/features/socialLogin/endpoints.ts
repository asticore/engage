import type { Fetcher } from './jwt'
import { PROVIDERS, type ProviderConfig, type ProviderId } from './providers'

/**
 * Where to send people and where to check what comes back, for one provider.
 * Built-in providers have fixed addresses. The free-form provider reads them
 * from its OpenID Connect discovery document (cached ten minutes), with any
 * address typed in by the owner winning over the document.
 */

export type Endpoints = {
  authUrl: string
  tokenUrl: string
  /** Where the ID token's signing keys are. Null when the provider sends no ID token. */
  jwksUrl: string | null
  /** The issuer an ID token must name. Null for providers that need no issuer check here. */
  issuer: string | null
  userinfoUrl: string | null
}

export class EndpointError extends Error {
  constructor(public readonly reason: string) {
    super(reason)
  }
}

const DISCOVERY_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; doc: Record<string, unknown> }>()
export const clearDiscoveryCache = (): void => cache.clear()

/**
 * Only https addresses on a real host name: no plain http, no IP literals, no
 * localhost or internal names, no credentials in the address. The owner types
 * these in, but the server is the one that calls them.
 */
export function isSafeHttpsUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false
  const host = url.hostname.toLowerCase()
  if (!host.includes('.') || host.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  if (host === 'localhost' || /\.(local|localhost|internal|lan|home|corp)$/.test(host)) return false
  return true
}

async function discovery(url: string, fetchImpl: Fetcher, now: number): Promise<Record<string, unknown>> {
  const hit = cache.get(url)
  if (hit && now - hit.at < DISCOVERY_TTL_MS) return hit.doc
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) throw new EndpointError('discovery')
    const doc = (await response.json().catch((): null => null)) as Record<string, unknown> | null
    if (!doc || typeof doc !== 'object') throw new EndpointError('discovery')
    cache.set(url, { at: now, doc })
    return doc
  } catch (error) {
    if (error instanceof EndpointError) throw error
    throw new EndpointError('network')
  } finally {
    clearTimeout(timer)
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

export async function resolveEndpoints(id: ProviderId, cfg: ProviderConfig, fetchImpl: Fetcher, now: number = Date.now()): Promise<Endpoints> {
  const def = PROVIDERS[id]
  if (id !== 'oidc') {
    return { authUrl: def.authUrl(cfg), tokenUrl: def.tokenUrl(cfg), jwksUrl: def.oidc?.jwksUrl ?? null, issuer: null, userinfoUrl: null }
  }

  let doc: Record<string, unknown> = {}
  if (cfg.discoveryUrl.trim()) {
    if (!isSafeHttpsUrl(cfg.discoveryUrl.trim())) throw new EndpointError('bad-endpoint')
    doc = await discovery(cfg.discoveryUrl.trim(), fetchImpl, now)
  }
  const authUrl = cfg.authUrl.trim() || text(doc.authorization_endpoint)
  const tokenUrl = cfg.tokenUrl.trim() || text(doc.token_endpoint)
  const userinfoUrl = cfg.userinfoUrl.trim() || text(doc.userinfo_endpoint)
  const jwksUrl = text(doc.jwks_uri)
  const issuer = text(doc.issuer)
  for (const address of [authUrl, tokenUrl, userinfoUrl, jwksUrl]) {
    if (address && !isSafeHttpsUrl(address)) throw new EndpointError('bad-endpoint')
  }
  if (!authUrl || !tokenUrl) throw new EndpointError('discovery')
  return { authUrl, tokenUrl, jwksUrl: jwksUrl || null, issuer: issuer || null, userinfoUrl: userinfoUrl || null }
}
