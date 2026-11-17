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
 * Verified bots (search engines) are never blocked by this.
 */

export type BotMode = 'off' | 'challenge' | 'block'

export const DEFAULT_BOT_MODE: BotMode = 'off'
export const DEFAULT_BOT_MIN_SCORE = 30

export type BotSignals = { score: number | null; verifiedBot: boolean }

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
  return { score, verifiedBot }
}

/** True when the score says automated: below the minimum and not a verified bot. */
export function isLikelyBot(signals: BotSignals, minScore: number = DEFAULT_BOT_MIN_SCORE): boolean {
  if (signals.score === null || signals.verifiedBot) return false
  return signals.score < minScore
}

/** What to do with this visitor in the given mode. */
export function botDecision(mode: BotMode, signals: BotSignals, minScore: number = DEFAULT_BOT_MIN_SCORE): 'allow' | 'challenge' | 'block' {
  if (mode === 'off' || !isLikelyBot(signals, minScore)) return 'allow'
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
