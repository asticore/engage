import { RECAPTCHA_FIELD, TURNSTILE_FIELD, checkCaptcha } from '@/features/forms/spam'
import { getFormSettings, type EngineLike } from '@/features/forms/settings'
import type { ResolvedFormSettings } from '@/features/forms/types'
import { FALLBACK_ANSWER_FIELD, FALLBACK_TOKEN_FIELD, checkFallback, makeFallback, type FallbackQuestion } from './captchaFallback'
import { botDecision, currentBotSignals, parseList, type BotSignals } from './botSignals'
import { CAPTCHA_PLACES, effectiveMode, failuresReached, isPlaceId, type PlaceId } from './captchaPlaces'
import { hitShared, peekShared } from './rateLimit'

/**
 * The CAPTCHA (Turnstile or reCAPTCHA, keys in Form settings) on every place that can ask for it: sign-in, create account,
 * forgot password, magic link and email code request, code entry, comments, chat, reviews, back-in-stock, RSVP and bank
 * transfer, cheque and cash orders. Each place has a mode (Form settings, Spam protection): off, always, or only after
 * repeated failures from the same address. A low Cloudflare bot score (Bot detection) can ask on any place too.
 * Fails open when the keys are missing or the provider cannot be reached (a log line, never a locked-out site).
 */

export type PublicCaptcha = { provider: 'turnstile' | 'recaptcha'; siteKey: string; appearance?: 'visible' | 'invisible'; fallback?: FallbackQuestion | null }

/** Old place names still passed by a few callers. */
export type CaptchaPlace = PlaceId | 'signin'

const placeId = (place: CaptchaPlace): PlaceId => (place === 'signin' ? 'signIn' : place)

const failureKey = (place: PlaceId, ip: string | undefined): string => `captcha:fail:${place}:${ip || 'unknown'}`

const hasKeys = (s: ResolvedFormSettings): boolean =>
  s.captchaProvider === 'recaptcha' ? Boolean(s.recaptchaSiteKey && s.recaptchaSecretKey) : Boolean(s.turnstileSiteKey && s.turnstileSecretKey)

export type PlaceDecision = {
  /** The visitor must pass the challenge here. */
  required: boolean
  /** A low bot score says refuse outright (Bot detection, third option). */
  block: boolean
  /** Why it is required, for the audit log: the mode, or the bot score. */
  why: 'always' | 'failures' | 'bot' | null
  settings: ResolvedFormSettings
}

/** Does this place ask for the challenge for this visitor right now. Never throws. */
export async function placeDecision(engine: EngineLike, place: CaptchaPlace, ip?: string, signals?: BotSignals): Promise<PlaceDecision> {
  const id = placeId(place)
  const s = await getFormSettings(engine)
  const none: PlaceDecision = { required: false, block: false, why: null, settings: s }
  try {
    const bot = s.botDetection === 'off' ? 'allow' : botDecision(s.botDetection, signals ?? (await currentBotSignals()), s.botMinScore, { fingerprints: parseList(s.botFingerprints), allowedCategories: parseList(s.botAllowedCategories) })
    if (bot === 'block') return { ...none, block: true }
    const mode = effectiveMode(id, s.placeModes[id], { turnstile: s.turnstile, protectSignIn: s.protectSignIn })
    let why: PlaceDecision['why'] = null
    if (mode === 'always') why = 'always'
    else if (mode === 'failures' && failuresReached(await peekShared(failureKey(id, ip), { windowMs: s.failureWindowMinutes * 60_000 }), s.failureThreshold)) why = 'failures'
    else if (bot === 'challenge') why = 'bot'
    // Keys are the only other condition: without them nothing is asked, so a site is never locked out.
    return why && hasKeys(s) ? { ...none, required: true, why } : none
  } catch {
    return none
  }
}

/** What the browser needs to draw the widget, or null when the challenge is not asked here (now). */
export async function authCaptchaConfig(engine: EngineLike, place: CaptchaPlace = 'signIn', signals?: BotSignals, ip?: string): Promise<PublicCaptcha | null> {
  const d = await placeDecision(engine, place, ip, signals)
  if (!d.required) return null
  const siteKey = d.settings.captchaProvider === 'recaptcha' ? d.settings.recaptchaSiteKey : d.settings.turnstileSiteKey
  return siteKey ? { provider: d.settings.captchaProvider, siteKey, appearance: d.settings.captchaAppearance, fallback: await makeFallback().catch((): null => null) } : null
}

const REFUSAL = 'Please complete the challenge and try again.'

/** A message to show when the challenge failed, else null. A refusal is logged to the audit log (Security, Audit log). */
export async function authCaptchaRefusal(engine: EngineLike, form: FormData, ip?: string, place: CaptchaPlace = 'signIn', signals?: BotSignals): Promise<string | null> {
  const id = placeId(place)
  try {
    const d = await placeDecision(engine, id, ip, signals)
    if (d.block) {
      await logBotFlag(engine, id, ip, 'refused')
      await logRefusal(engine, id, ip, 'bot score too low')
      return REFUSAL
    }
    if (d.why === 'bot') await logBotFlag(engine, id, ip, 'asked')
    if (!d.required) {
      // Places that count tries note each one here; places that count failures are noted by their caller on a real failure.
      if (CAPTCHA_PLACES.find((p) => p.id === id)?.counts === 'tries') await noteCaptchaFailure(engine, id, ip)
      return null
    }
    // The text question is the accessible way through when the widget cannot be used.
    if (form.get(FALLBACK_ANSWER_FIELD) && (await checkFallback(form.get(FALLBACK_TOKEN_FIELD), form.get(FALLBACK_ANSWER_FIELD)))) return null
    const verdict = await checkCaptcha({ turnstile: form.get(TURNSTILE_FIELD), recaptcha: form.get(RECAPTCHA_FIELD) }, { ...d.settings, turnstile: true }, ip)
    if (!verdict.spam || verdict.reason === 'turnstile-unavailable') return null
    await logRefusal(engine, id, ip, `${d.why}: ${verdict.detail ?? 'challenge not passed'}`)
    await noteCaptchaFailure(engine, id, ip)
    return REFUSAL
  } catch {
    return null
  }
}

/**
 * Counts one failure (or, for places with no failed step, one try) from this address towards "only after repeated
 * failures". Only counts when that place is in that mode, so other modes cost no writes.
 */
export async function noteCaptchaFailure(engine: EngineLike, place: CaptchaPlace, ip?: string): Promise<void> {
  try {
    const id = placeId(place)
    const s = await getFormSettings(engine)
    if (effectiveMode(id, s.placeModes[id], { turnstile: s.turnstile, protectSignIn: s.protectSignIn }) !== 'failures') return
    await hitShared(failureKey(id, ip), 1_000_000, { windowMs: s.failureWindowMinutes * 60_000 })
  } catch {
    // A counter that cannot be written must never fail the request.
  }
}

/** One audit line per address and hour when the bot score flags a visitor: the count behind "visitors flagged" in Authentication. */
async function logBotFlag(engine: EngineLike, id: PlaceId, ip: string | undefined, outcome: 'asked' | 'refused'): Promise<void> {
  try {
    const seen = await hitShared(`captcha:flag:${ip || 'unknown'}`, 1, { windowMs: 3_600_000 })
    if (seen.limited) return
    const { recordAuthEvent } = await import('./authAudit')
    await recordAuthEvent(engine, { action: 'bot.flagged', detail: `${id}: ${outcome}` }, { ip: ip ?? null })
  } catch {
    // Counting never changes the answer.
  }
}

async function logRefusal(engine: EngineLike, id: PlaceId, ip: string | undefined, detail: string): Promise<void> {
  try {
    const { recordAuthEvent } = await import('./authAudit')
    await recordAuthEvent(engine, { action: 'captcha.failed', detail: `${id}: ${detail}` }, { ip: ip ?? null })
  } catch {
    // Logging never changes the answer.
  }
}

/** The challenge tokens a JSON or fetch request carries, in the form `authCaptchaRefusal` reads: body fields first, then headers. */
export function captchaFormFrom(body: unknown, headers?: { get(name: string): string | null } | null): FormData {
  const form = new FormData()
  const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  for (const field of [TURNSTILE_FIELD, RECAPTCHA_FIELD, FALLBACK_ANSWER_FIELD, FALLBACK_TOKEN_FIELD]) {
    const fromBody = source[field]
    const value = typeof fromBody === 'string' && fromBody ? fromBody : headers?.get(`x-${field}`)
    if (value) form.set(field, value)
  }
  return form
}

export { isPlaceId }
