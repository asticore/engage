/**
 * First-login order for an admin: (1) change the start email and password on the user's own profile,
 * (2) set up two-step sign-in, (3) only then the dashboard with the setup questions and tour.
 * One function decides, so the two guards can never send the user back and forth.
 */
export type FirstLoginInput = {
  /** Admin-relative path, e.g. `/security/two-factor`. */
  pathname: string
  /** Admin-relative path of the user's own profile screen. */
  profilePath: string
  /** The start login, or a password older than the maximum age. */
  profileChangeDue: boolean
  /** Two-step is required, not yet set up, and past any grace period. */
  twoFactorMustEnrol: boolean
  twoFactorPath: string
}

const on = (pathname: string, target: string) => pathname === target || pathname.startsWith(`${target}/`)

/** Which screen to send the user to, or null when they may stay where they are. */
export function firstLoginRedirect(input: FirstLoginInput): 'profile' | 'twoFactor' | null {
  if (input.profileChangeDue) return on(input.pathname, input.profilePath) ? null : 'profile'
  if (input.twoFactorMustEnrol) return on(input.pathname, input.twoFactorPath) ? null : 'twoFactor'
  return null
}

/** True while the owner still has a security step to finish: the tour and setup questions wait. */
export const firstLoginPending = (input: Pick<FirstLoginInput, 'profileChangeDue' | 'twoFactorMustEnrol'>): boolean =>
  input.profileChangeDue || input.twoFactorMustEnrol
