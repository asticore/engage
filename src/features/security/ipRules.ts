/**
 * IP allow and block lists (Task 19c), pure parts: parsing an entry (single address or CIDR, IPv4 or IPv6),
 * matching an address, and the allow-first decision. No I/O, so every rule is testable on its own.
 */

export type IpRuleKind = 'allow' | 'block'
export type IpRule = { id: number; kind: IpRuleKind; entry: string; reason: string; expiresAt: string | null; createdAt: string }
export type Parsed = { v: 4 | 6; value: bigint; bits: number }

export function parseIp(text: string): { v: 4 | 6; value: bigint } | null {
  const t = text.trim().toLowerCase()
  const v4 = t.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const parts = v4.slice(1).map(Number)
    if (parts.some((n) => n > 255)) return null
    return { v: 4, value: parts.reduce((acc, n) => (acc << 8n) | BigInt(n), 0n) }
  }
  if (!/^[0-9a-f:.]+$/.test(t) || !t.includes(':') || (t.match(/::/g) ?? []).length > 1) return null
  const [head, tail] = t.split('::')
  const toGroups = (s: string): string[] | null => (s === '' ? [] : s.split(':'))
  const h = toGroups(head ?? '')
  const tl = t.includes('::') ? toGroups(tail ?? '') : []
  if (!h || !tl) return null
  const missing = 8 - h.length - tl.length
  if (t.includes('::') ? missing < 1 : missing !== 0) return null
  const groups = [...h, ...Array(t.includes('::') ? missing : 0).fill('0'), ...tl]
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return { v: 6, value: groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n) }
}

/** An entry is one address or an address with /prefix. Returns null when it is not valid. */
export function parseEntry(text: string): Parsed | null {
  const [addr, prefix, extra] = text.trim().split('/')
  if (extra !== undefined || !addr) return null
  const ip = parseIp(addr)
  if (!ip) return null
  const max = ip.v === 4 ? 32 : 128
  if (prefix === undefined) return { ...ip, bits: max }
  if (!/^\d{1,3}$/.test(prefix)) return null
  const bits = Number(prefix)
  return bits > max ? null : { ...ip, bits }
}

export function matches(ip: string, entry: string): boolean {
  const a = parseIp(ip)
  const e = parseEntry(entry)
  if (!a || !e || a.v !== e.v) return false
  const max = a.v === 4 ? 32 : 128
  const shift = BigInt(max - e.bits)
  return a.value >> shift === e.value >> shift
}

const live = (r: IpRule, now: number): boolean => !r.expiresAt || Date.parse(r.expiresAt) > now

/** Allow list wins over block list. An unknown address is never blocked. */
export function decideIp(ip: string, rules: readonly IpRule[], now = Date.now()): 'allow' | 'block' | 'none' {
  if (!parseIp(ip)) return 'none'
  const active = rules.filter((r) => live(r, now))
  if (active.some((r) => r.kind === 'allow' && matches(ip, r.entry))) return 'allow'
  if (active.some((r) => r.kind === 'block' && matches(ip, r.entry))) return 'block'
  return 'none'
}

/** One entry per line (or comma separated); `#` starts a comment. Returns valid entries and the ones that were refused. */
export function parseBulk(text: string): { entries: string[]; rejected: string[] } {
  const entries: string[] = []
  const rejected: string[] = []
  for (const raw of text.split(/[\n,;]+/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    if (parseEntry(line)) {
      if (!entries.includes(line.toLowerCase())) entries.push(line.toLowerCase())
    } else rejected.push(line.slice(0, 60))
  }
  return { entries: entries.slice(0, 500), rejected: rejected.slice(0, 20) }
}

export const MAX_RULES = 2000
