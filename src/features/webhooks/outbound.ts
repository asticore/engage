import { isBlockedIPv4 } from './core'

/**
 * DNS rebinding guard for outgoing webhook targets.
 *
 * A host name that is public when the address is typed can later point at a private, loopback or
 * link-local address (a rebinding attack). Before each send the name is resolved with DNS over HTTPS
 * (two small queries: A and AAAA) and every answer is checked against the blocked ranges. Any answer
 * in a blocked range refuses the send permanently. A resolution that fails for another reason is
 * a failed attempt that is retried later, never a silent pass.
 *
 * What Workers cannot do (kept here and in the Open now list of remaining-work.md):
 *  - A Worker's fetch() cannot be pinned to the checked address. It resolves the host again when it
 *    connects, and it does not say which address it used, so a name that changes its answer between
 *    the check and the connect is not caught. This guard narrows the window; it does not close it.
 *  - The Host header cannot be set to a name while connecting to an IP, so the check cannot be done
 *    on the connection itself.
 *  - The redirect is never followed (redirect: 'manual'), so no second address is ever contacted.
 *    That is the "re-check on redirect" rule: nothing is re-resolved because nothing is followed.
 *  - Workers run on Cloudflare's network, not inside the site owner's network, so the blocked ranges
 *    are mainly the platform's own internal addresses and metadata endpoints.
 *  - Each check costs two DNS subrequests per attempt, which counts against the Worker's subrequest
 *    limit for that invocation (the cron job sends at most 20 rows, so this stays inside it).
 */

export const DNS_RESOLVER_URL = 'https://cloudflare-dns.com/dns-query'
const DNS_TIMEOUT_MS = 3000

/** Blocked IPv6 ranges: unspecified, loopback, unique local, link-local, site-local, multicast, documentation and the NAT64 prefix (checked on the embedded IPv4). */
export function isBlockedIPv6(address: string): boolean {
  const lower = address
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .split('%')[0]
  if (lower === '::' || lower === '::1' || lower.startsWith('::')) return true // unspecified, loopback, and the deprecated IPv4-compatible range
  const mapped = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower)
  if (mapped) return isBlockedIPv4(Number(mapped[1]), Number(mapped[2]), Number(mapped[3]))
  const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower)
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16)
    const lo = parseInt(hexMapped[2], 16)
    return isBlockedIPv4(hi >> 8, hi & 255, lo >> 8)
  }
  const first = parseInt(lower.split(':')[0] || '0', 16)
  if (Number.isNaN(first)) return true
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link local
  if ((first & 0xffc0) === 0xfec0) return true // fec0::/10 site local (deprecated)
  if ((first & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (first === 0x2001 && lower.startsWith('2001:db8')) return true // documentation
  if (lower.startsWith('64:ff9b:')) {
    const parts = lower.split(':')
    const hi = parseInt(parts[parts.length - 2] ?? '0', 16)
    const lo = parseInt(parts[parts.length - 1] ?? '0', 16)
    return isBlockedIPv4(hi >> 8, hi & 255, lo >> 8)
  }
  return false
}

/** True for any address a webhook must never reach, IPv4 or IPv6. */
export function isBlockedAddress(address: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address.trim())
  if (v4) return isBlockedIPv4(Number(v4[1]), Number(v4[2]), Number(v4[3]))
  if (address.includes(':')) return isBlockedIPv6(address)
  return true
}

export type TargetCheck =
  { ok: true; addresses: string[] } | { ok: false; permanent: boolean; error: string }

/** Resolves a host name to its A and AAAA addresses over DNS over HTTPS. Throws when the lookup itself fails. */
export async function resolveWithDoh(
  host: string,
  fetcher: typeof fetch = fetch,
): Promise<string[]> {
  const addresses: string[] = []
  const lookups = [
    { type: 'A', code: 1 },
    { type: 'AAAA', code: 28 },
  ]
  const results = await Promise.all(
    lookups.map(async ({ type, code }) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS)
      try {
        const url = `${DNS_RESOLVER_URL}?name=${encodeURIComponent(host)}&type=${type}`
        const response = await fetcher(url, {
          headers: { accept: 'application/dns-json' },
          signal: controller.signal,
          redirect: 'error',
        })
        if (!response.ok) throw new Error(`DNS lookup answered ${response.status}`)
        const body = (await response.json()) as {
          Status?: number
          Answer?: { type: number; data: string }[]
        }
        if (body.Status === 3) return [] // NXDOMAIN
        if (body.Status !== 0) throw new Error(`DNS lookup status ${body.Status}`)
        return (body.Answer ?? [])
          .filter((record) => record.type === code)
          .map((record) => String(record.data))
      } finally {
        clearTimeout(timer)
      }
    }),
  )
  for (const list of results) addresses.push(...list)
  return addresses
}

/**
 * Checks where a host name points right now. A blocked answer is permanent (the delivery fails and
 * the webhook may be switched off). No answer or a failed lookup is retried.
 */
export async function checkDeliveryTarget(
  url: string,
  resolve: (host: string) => Promise<string[]> = (host) => resolveWithDoh(host),
): Promise<TargetCheck> {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  } catch {
    return { ok: false, permanent: true, error: 'The address is not a valid web address.' }
  }
  if (host.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    // An address written as a literal needs no lookup, only the range check.
    return isBlockedAddress(host)
      ? {
          ok: false,
          permanent: true,
          error: 'That address is on a private or internal network. Use a public address.',
        }
      : { ok: true, addresses: [host] }
  }
  let addresses: string[]
  try {
    addresses = await resolve(host)
  } catch {
    return {
      ok: false,
      permanent: false,
      error: 'The address could not be checked. It will be tried again.',
    }
  }
  if (addresses.length === 0)
    return {
      ok: false,
      permanent: false,
      error: 'The address did not resolve. It will be tried again.',
    }
  if (addresses.some(isBlockedAddress))
    return {
      ok: false,
      permanent: true,
      error: 'The address resolves to a private or internal network, so it was not sent.',
    }
  return { ok: true, addresses }
}
