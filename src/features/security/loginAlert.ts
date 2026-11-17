/**
 * Sign-in alerts (Task 19g, first slice): an email when someone signs in from a device or country this account has not
 * used before. Pure parts and a sink, so the sign-in code reaches no database or email code. The first sign-in an account
 * ever makes after this ships is only recorded, never alerted, so turning it on does not email every user at once.
 */
import { deviceLabelFromUserAgent } from './userSessions'

export type SignInEvent = { userId: number; email: string; userAgent: string | null; country: string | null; ip: string | null; at: string }
export type SeenPair = { device: string; country: string }
export type AlertKind = 'new-device' | 'new-country'

let sink: ((event: SignInEvent) => void) | null = null
export const setLoginAlertSink = (fn: ((event: SignInEvent) => void) | null): void => {
  sink = fn
}
/** Called from sign-in. Never throws and never waits. */
export function notifySignIn(event: SignInEvent): void {
  try {
    sink?.(event)
  } catch {
    // An alert problem must never stop a sign-in.
  }
}

export const cleanCountry = (value: string | null | undefined): string => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' ? code : ''
}
export const deviceKey = (userAgent: string | null | undefined): string => deviceLabelFromUserAgent(userAgent)

/** Null when nothing is new (or the account has no history yet). A new country wins over a new device. */
export function decideAlert(seen: SeenPair[], now: { device: string; country: string }): AlertKind | null {
  if (seen.length === 0) return null
  if (now.country && !seen.some((s) => s.country === now.country)) return 'new-country'
  if (!seen.some((s) => s.device === now.device)) return 'new-device'
  return null
}

export function alertText(kind: AlertKind, e: { device: string; country: string; at: string }): { subject: string; text: string } {
  let place = ''
  try {
    place = e.country ? ` near ${new Intl.DisplayNames(['en'], { type: 'region' }).of(e.country) ?? e.country}` : ''
  } catch {
    place = ''
  }
  return {
    subject: kind === 'new-country' ? 'New sign-in from a new country' : 'New sign-in from a new device',
    text: [
      `Your account was just signed in to from ${e.device}${place} at ${e.at}.`,
      '',
      'If this was you, there is nothing to do.',
      'If it was not, sign in, change your password and use "Sign out everywhere" in your account security settings.',
    ].join('\n'),
  }
}
