/**
 * Task 25d: AI agent access. An agent token is an ordinary scoped API key (see src/features/apiKeys) that has a
 * grant attached: a tool label, a daily cap on writes and reads, and a full action log. Pure rules only; no I/O.
 */

export type AgentGrant = {
  id: number
  keyId: number
  label: string
  tool: string
  /** Writes (POST and PATCH) allowed per UTC day. 0 means no cap. */
  dailyWriteCap: number
  /** Reads (GET and HEAD) allowed per UTC day. 0 means no cap. */
  dailyReadCap: number
  createdBy: number | null
  createdAt: string
  revokedAt: string | null
}

export type AgentAction = {
  id: number
  grantId: number
  keyId: number
  at: string
  method: string
  path: string
  outcome: 'allowed' | 'capped' | 'refused'
}

export const DEFAULT_WRITE_CAP = 200
export const DEFAULT_READ_CAP = 5000
export const MAX_CAP = 1_000_000
export const MAX_LABEL = 80
export const MAX_PATH = 200
export const DEFAULT_RETENTION_DAYS = 90

/** The UTC day a request counts against. */
export const agentDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export type RequestKind = 'read' | 'write' | 'other'

export const kindOfMethod = (method: string): RequestKind => {
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'HEAD') return 'read'
  if (m === 'POST' || m === 'PATCH') return 'write'
  return 'other'
}

/** A path for the log: the REST slug only, no query string, no ids that look like secrets, cut to a safe length. */
export const logPath = (slug: readonly string[]): string => slug.join('/').slice(0, MAX_PATH)

export type CapDecision = { ok: true } | { ok: false; reason: string }

/** Whether one more request of `kind` fits under the grant's caps, given what was already counted today. */
export function checkCap(grant: Pick<AgentGrant, 'dailyWriteCap' | 'dailyReadCap'>, kind: RequestKind, counted: { reads: number; writes: number }): CapDecision {
  if (kind === 'write' && grant.dailyWriteCap > 0 && counted.writes >= grant.dailyWriteCap) {
    return { ok: false, reason: `This agent has used its ${grant.dailyWriteCap} writes for today. It can write again tomorrow, or an admin can raise the cap.` }
  }
  if (kind === 'read' && grant.dailyReadCap > 0 && counted.reads >= grant.dailyReadCap) {
    return { ok: false, reason: `This agent has used its ${grant.dailyReadCap} reads for today. It can read again tomorrow, or an admin can raise the cap.` }
  }
  return { ok: true }
}

const intIn = (value: unknown, fallback: number): number => {
  if (value === '' || value === null || value === undefined) return fallback
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, MAX_CAP)
}

export type GrantInput = { label: string; tool: string; dailyWriteCap: number; dailyReadCap: number }

export function validateGrantInput(raw: Record<string, unknown>): { ok: true; value: GrantInput } | { ok: false; error: string } {
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  if (!label) return { ok: false, error: 'Give the agent a name.' }
  if (label.length > MAX_LABEL) return { ok: false, error: `The name must be ${MAX_LABEL} characters or fewer.` }
  const tool = typeof raw.tool === 'string' ? raw.tool.trim().slice(0, MAX_LABEL) : ''
  const dailyWriteCap = intIn(raw.dailyWriteCap, DEFAULT_WRITE_CAP)
  const dailyReadCap = intIn(raw.dailyReadCap, DEFAULT_READ_CAP)
  return { ok: true, value: { label, tool, dailyWriteCap, dailyReadCap } }
}

/** A short plain sentence describing the caps, for the list. */
export function describeCaps(grant: Pick<AgentGrant, 'dailyWriteCap' | 'dailyReadCap'>): string {
  const w = grant.dailyWriteCap > 0 ? `${grant.dailyWriteCap} writes` : 'unlimited writes'
  const r = grant.dailyReadCap > 0 ? `${grant.dailyReadCap} reads` : 'unlimited reads'
  return `${w} and ${r} a day`
}

/** The cutoff ISO time before which log rows may be purged, or null when `days` is 0 (keep everything). */
export function retentionCutoff(now: Date, days: number): string | null {
  if (!Number.isFinite(days) || days <= 0) return null
  return new Date(now.getTime() - days * 86_400_000).toISOString()
}
