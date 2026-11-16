import { PROVIDER_IDS, PROVIDERS, missingCredentials, type SocialConfig } from '@/features/socialLogin/providers'

import type { SecuritySettings } from './settings'

/**
 * One row per sign-in method for the Authentication overview: is it on, does it still need setup,
 * and where to change it. Pure, so it can be tested without a database. Nothing is changed from
 * here; every row links to the screen that owns the setting.
 */

export type MethodStatus = 'on' | 'off' | 'needs-setup'
export type MethodRow = { id: string; label: string; status: MethodStatus; detail: string; href: string; toggle?: boolean }

const SECURITY = '/globals/security-settings'

export function describeAuthMethods(settings: SecuritySettings, social: SocialConfig): MethodRow[] {
  const rows: MethodRow[] = [
    { id: 'password', label: 'Password', status: 'on', detail: 'Always available. Password rules are in Security settings.', href: SECURITY },
    {
      id: 'email-verification',
      label: 'Email verification',
      status: settings.emailVerification.requireToSignIn ? 'on' : 'off',
      detail: settings.emailVerification.requireToSignIn ? 'Customers must confirm their address before signing in.' : 'Customers can sign in without confirming their address.',
      href: SECURITY,
      toggle: true,
    },
    { id: 'magic-link', label: 'Magic link', status: settings.passwordless.magicLinkEnabled ? 'on' : 'off', detail: 'Sign in from a link sent by email.', href: SECURITY, toggle: true },
    { id: 'email-code', label: 'Email code', status: settings.passwordless.emailCodeEnabled ? 'on' : 'off', detail: 'Sign in with a one-time code sent by email.', href: SECURITY, toggle: true },
    { id: 'passkeys', label: 'Passkeys', status: settings.passkeys.enabled ? 'on' : 'off', detail: 'Sign in with a fingerprint, face or device lock.', href: '/security/passkeys', toggle: true },
    {
      id: 'two-factor',
      label: 'Two-step sign-in',
      status: 'on',
      detail: `Authenticator app and backup codes are always offered${settings.twoFactor.emailOtpEnabled ? ', plus email codes' : ''}${settings.twoFactor.requiredRoles.length ? `. Required for: ${settings.twoFactor.requiredRoles.join(', ')}` : ''}.`,
      href: '/security/two-factor',
    },
  ]
  for (const id of PROVIDER_IDS) {
    const cfg = social.providers[id]
    const missing = missingCredentials(id, cfg)
    const status: MethodStatus = !cfg.enabled ? 'off' : missing.length ? 'needs-setup' : 'on'
    rows.push({
      id: `social-${id}`,
      label: PROVIDERS[id].label,
      status,
      detail: status === 'needs-setup' ? `Switched on but missing: ${missing.join(', ')}. The button stays hidden until complete.` : status === 'on' ? 'Shown on the sign-in form.' : 'Not offered.',
      href: SECURITY,
      toggle: status !== 'needs-setup',
    })
  }
  return rows
}

/** The settings patch that switches one method on or off, or null when the method has no switch. Social patches touch only that provider's flag. */
export function togglePatch(id: string, on: boolean): Record<string, unknown> | null {
  if (id === 'magic-link') return { magicLinkEnabled: on }
  if (id === 'email-code') return { emailCodeEnabled: on }
  if (id === 'passkeys') return { passkeysEnabled: on }
  if (id === 'email-verification') return { emailVerificationRequired: on }
  if (id.startsWith('social-')) {
    const provider = id.slice('social-'.length)
    if ((PROVIDER_IDS as readonly string[]).includes(provider)) return { socialLogin: { [`${provider}Enabled`]: on } }
  }
  return null
}
