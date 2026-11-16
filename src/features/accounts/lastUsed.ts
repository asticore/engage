/**
 * "Last used" sign-in method, remembered per browser in a plain cookie (a convenience, not tracking:
 * it holds one short method name, never an account). Pure helpers so the rules can be tested.
 */

export const LAST_METHOD_COOKIE = 'eg_last_method'

/** A method name is lowercase letters, digits and dashes, up to 32 characters. Anything else is ignored. */
export function cleanMethod(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9-]{1,32}$/.test(value) ? value : null
}

export function readLastMethod(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === LAST_METHOD_COOKIE) return cleanMethod(decodeURIComponent(rest.join('=')))
  }
  return null
}

export const lastMethodCookie = (method: string): string => `${LAST_METHOD_COOKIE}=${encodeURIComponent(method)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`

/** The method a click or submit on the sign-in screen stands for, or null. `password` for a form with a password field, a provider id for a social button. */
export function methodFor(target: { socialClass?: string | null; formHasPassword?: boolean }): string | null {
  const match = /account-social__button--([a-z0-9-]+)/.exec(target.socialClass ?? '')
  if (match) return cleanMethod(match[1])
  return target.formHasPassword ? 'password' : null
}

/** The emailed and passkey methods have buttons, not links. `kind` is the button's name=kind value, `inPasskeyBox` is true inside `.account-passkey`. */
export function methodForButton(target: { kind?: string | null; inPasskeyBox?: boolean }): string | null {
  if (target.inPasskeyBox) return 'passkey'
  if (target.kind === 'link') return 'magic-link'
  if (target.kind === 'code') return 'email-code'
  return null
}

/** CSS selector for the control that carries the badge for a remembered method (password is found from its form instead). */
export function selectorForMethod(method: string): string | null {
  if (method === 'passkey') return '.account-passkey button'
  if (method === 'magic-link') return 'button[name="kind"][value="link"]'
  if (method === 'email-code') return 'button[name="kind"][value="code"]'
  return cleanMethod(method) ? `.account-social__button--${method}` : null
}
