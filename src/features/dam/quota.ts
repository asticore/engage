/** Storage quotas (Task 29g): one site wide limit plus limits per role or company. Pure rules. */

export type QuotaScope = 'role' | 'company'
export type Quota = { scope: QuotaScope; key: string; mb: number }

export function parseQuotas(value: unknown): { ok: true; value: Quota[] } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: [] }
  if (!Array.isArray(value) || value.length > 100) return { ok: false, error: 'Quotas must be a list of up to 100 rows.' }
  const out: Quota[] = []
  for (const row of value as Array<Record<string, unknown>>) {
    const scope = row.scope === 'company' ? 'company' : row.scope === 'role' ? 'role' : null
    const key = typeof row.key === 'string' ? row.key.trim() : ''
    const mb = Number(row.mb)
    if (!scope || !key || key.length > 80 || !Number.isInteger(mb) || mb < 1 || mb > 10_000_000) return { ok: false, error: 'Each quota needs a role or company and a whole number of megabytes (1 or more).' }
    if (out.some((q) => q.scope === scope && q.key === key)) return { ok: false, error: 'A role or company can have one quota.' }
    out.push({ scope, key, mb })
  }
  return { ok: true, value: out }
}

export const parseQuotaJson = (text: unknown): Quota[] => {
  try {
    const parsed = parseQuotas(JSON.parse(String(text || '[]')))
    return parsed.ok ? parsed.value : []
  } catch {
    return []
  }
}

const MB = 1024 * 1024

export type QuotaCheck = { ok: true } | { ok: false; error: string }

/**
 * Can `incoming` bytes be stored? `siteUsed` is everything in the library; `used(quota)` is what that role or company
 * already uploaded. Only the quotas that apply to this user (their roles and companies) count.
 */
export function checkQuota(args: { incoming: number; siteLimitMb: number; siteUsed: number; quotas: Quota[]; roles: string[]; companyIds: string[]; used: (q: Quota) => number }): QuotaCheck {
  const { incoming, siteLimitMb, siteUsed, quotas, roles, companyIds, used } = args
  if (siteLimitMb > 0 && siteUsed + incoming > siteLimitMb * MB) return { ok: false, error: `The library has reached its storage limit of ${siteLimitMb} MB.` }
  for (const q of quotas) {
    const applies = q.scope === 'role' ? roles.includes(q.key) : companyIds.includes(q.key)
    if (applies && used(q) + incoming > q.mb * MB) return { ok: false, error: `Your ${q.scope === 'role' ? 'role' : 'company'} has reached its storage limit of ${q.mb} MB.` }
  }
  return { ok: true }
}

export const kindOfMime = (mime: string): 'images' | 'video' | 'audio' | 'documents' | 'other' =>
  mime.startsWith('image/') ? 'images' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : /pdf|word|sheet|presentation|text\/|opendocument|msword/.test(mime) ? 'documents' : 'other'
