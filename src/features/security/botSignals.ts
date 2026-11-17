/**
 * Bot detection: one verdict from the signals the edge gives us for free.
 *
 * The Cloudflare bot score (1 to 99, low means automated) is read from the
 * `cf-bot-score` header (Managed Transform "Add bot protection headers") or
 * from the request's `cf.botManagement.score` (Bot Management plans). Plans
 * without either send no score, and then this check does nothing: honeypot,
 * fill time, probe-path blocking and the CAPTCHA keep working on their own.
 *
 * Modes (Form settings, Spam protection):
 *  - off:       the score is ignored.
 *  - challenge: a low score makes the sign-in, register, reset, comment and
 *               chat places ask for the CAPTCHA even when their own switch is off
 *               (needs the challenge keys; without them nothing changes).
 *  - block:     a low score is refused outright on top of the challenge. Forms
 *               discard the submission quietly, like a honeypot hit.
 * Verified bots (search engines) are never blocked by this, unless allowed categories are set (see BotRules).
 */

export type BotMode = 'off' | 'challenge' | 'block'

export const DEFAULT_BOT_MODE: BotMode = 'off'
export const DEFAULT_BOT_MIN_SCORE = 30

export type BotSignals = {
  score: number | null
  verifiedBot: boolean
  /** TLS client fingerprints from Cloudflare (`cf-ja3-hash`, `cf-ja4`), lower case. Absent when the plan sends none. */
  ja3?: string
  ja4?: string
  /** Cloudflare's verified bot category (`cf-verified-bot-category`), e.g. "Search Engine Crawler". */
  category?: string
}

/**
 * Extra rules on top of the score (Form settings, Bot detection):
 *  - fingerprints: JA3 or JA4 hashes that always count as a bot, whatever the score.
 *  - allowedCategories: with none listed every verified bot is let through; with some listed only verified bots in those
 *    categories are, and any other verified bot (an AI crawler, say) is treated like a bot.
 */
export type BotRules = { fingerprints?: readonly string[]; allowedCategories?: readonly string[] }

/** One value per line (or comma), trimmed, lower case, empties dropped. */
export function parseList(value: unknown): string[] {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
}

export function normaliseBotMode(value: unknown): BotMode {
  return value === 'challenge' || value === 'block' ? value : 'off'
}

function parseScore(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n >= 1 && n <= 99 ? n : null
}

type HeaderReader = { get(name: string): string | null }

/** Reads the edge's bot signals. Never throws; returns no score when none is available. */
export function readBotSignals(headers?: HeaderReader | null, cf?: unknown): BotSignals {
  let score = parseScore(headers?.get('cf-bot-score'))
  let verifiedBot = headers?.get('cf-verified-bot') === 'true'
  const management = (cf as { botManagement?: { score?: unknown; verifiedBot?: unknown } } | null | undefined)?.botManagement
  if (score === null) score = parseScore(management?.score)
  if (management?.verifiedBot === true) verifiedBot = true
  const ja3 = (headers?.get('cf-ja3-hash') || (management as { ja3Hash?: unknown } | undefined)?.ja3Hash || '').toString().trim().toLowerCase()
  const ja4 = (headers?.get('cf-ja4') || (management as { ja4?: unknown } | undefined)?.ja4 || '').toString().trim().toLowerCase()
  const category = (headers?.get('cf-verified-bot-category') || (cf as { verifiedBotCategory?: unknown } | null | undefined)?.verifiedBotCategory || '').toString().trim()
  return { score, verifiedBot, ...(ja3 ? { ja3 } : {}), ...(ja4 ? { ja4 } : {}), ...(category ? { category } : {}) }
}

/** True when the score says automated: below the minimum and not a verified bot. */
export function isLikelyBot(signals: BotSignals, minScore: number = DEFAULT_BOT_MIN_SCORE, rules: BotRules = {}): boolean {
  const allowed = (rules.allowedCategories ?? []).map((c) => c.toLowerCase())
  if (signals.verifiedBot) {
    // A verified bot is let through, unless categories are listed and this one is not among them.
    return allowed.length > 0 && !allowed.includes((signals.category ?? '').toLowerCase())
  }
  const prints = rules.fingerprints ?? []
  if (prints.length > 0 && [signals.ja3, signals.ja4].some((p) => p && prints.includes(p))) return true
  if (signals.score === null) return false
  return signals.score < minScore
}

/** What to do with this visitor in the given mode. */
export function botDecision(mode: BotMode, signals: BotSignals, minScore: number = DEFAULT_BOT_MIN_SCORE, rules: BotRules = {}): 'allow' | 'challenge' | 'block' {
  if (mode === 'off' || !isLikelyBot(signals, minScore, rules)) return 'allow'
  return mode === 'block' ? 'block' : 'challenge'
}

/** Signals for the current request inside a server action or route handler. Null score outside a request. */
export async function currentBotSignals(): Promise<BotSignals> {
  try {
    const { headers } = await import('next/headers')
    let cf: unknown
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      cf = (await getCloudflareContext({ async: true })).cf
    } catch {
      cf = undefined
    }
    return readBotSignals(await headers(), cf)
  } catch {
    return { score: null, verifiedBot: false }
  }
}
