import { GLOBAL_PROVIDER_IDS, PROVIDER_IDS, isExtraProviderId, missingCredentials, providerLabel, type SocialConfig } from '@/features/socialLogin/providers'

import { methodAllowed, type AuthMatrix, type MatrixArea } from './authMatrix'
import type { SecuritySettings } from './settings'

/**
 * One row per sign-in method for the Authentication overview: is it on, does it still need setup,
 * and where to change it. Pure, so it can be tested without a database. Nothing is changed from
 * here; every row links to the screen that owns the setting.
 */

export type MethodStatus = 'on' | 'off' | 'needs-setup'
export type MethodRow = { id: string; label: string; status: MethodStatus; detail: string; href: string; toggle?: boolean }

const SECURITY = '/globals/security-settings'

export type SsoInfo = { featureOn: boolean; connections: number; enforced: number }

export type AgentAccessInfo = { featureOn: boolean; apiKeysOn: boolean; activeTokens: number }

export function describeAuthMethods(settings: SecuritySettings, social: SocialConfig, agents?: AgentAccessInfo, sso?: SsoInfo): MethodRow[] {
  const rows: MethodRow[] = [
    { id: 'password', label: 'Password', status: 'on', detail: 'Always available. Password rules are in Security settings.', href: SECURITY },
    {
      id: 'username',
      label: 'Username',
      status: settings.usernameSignIn.enabled ? 'on' : 'off',
      detail: settings.usernameSignIn.enabled ? 'The account sign-in form accepts a username as well as an email.' : 'People sign in with their email address only.',
      href: SECURITY,
      toggle: true,
    },
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
      label: providerLabel(id, cfg),
      status,
      detail: status === 'needs-setup' ? `Switched on but missing: ${missing.join(', ')}. The button stays hidden until complete.` : status === 'on' ? 'Shown on the sign-in form.' : 'Not offered.',
      href: isExtraProviderId(id) ? '/security/sign-in-providers' : SECURITY,
      toggle: status !== 'needs-setup',
    })
  }
  if (sso) {
    const status: MethodStatus = !sso.featureOn ? 'off' : sso.connections > 0 ? 'on' : 'needs-setup'
    rows.push({
      id: 'org-sso',
      label: 'Single sign-on (organisations)',
      status,
      detail:
        status === 'off'
          ? 'Not offered. Switch Single sign-on on in Site Settings to let organisations use their own identity provider.'
          : status === 'needs-setup'
            ? 'Switched on, but no organisation has a connection yet.'
            : `${sso.connections} connection${sso.connections === 1 ? '' : 's'}${sso.enforced ? `, ${sso.enforced} requiring single sign-on` : ''}.`,
      href: '/sso',
    })
  }
  if (agents) {
    const status: MethodStatus = !agents.featureOn ? 'off' : agents.apiKeysOn ? 'on' : 'needs-setup'
    rows.push({
      id: 'agent-access',
      label: 'AI agent access',
      status,
      detail:
        status === 'off'
          ? 'Not offered. Switch it on in Site Settings to give connected AI tools their own capped, revocable tokens.'
          : status === 'needs-setup'
            ? 'Switched on, but API keys are off, so no agent token can be made. Switch API keys on in Security settings.'
            : `${agents.activeTokens} active agent token${agents.activeTokens === 1 ? '' : 's'}. Each is scoped, never deletes, stops at a daily cap and is logged.`,
      href: '/agent-access',
    })
  }
  return rows
}

/**
 * True while a customer or member sign-in place still has at least one way in: a password the owner
 * has not blocked, or another method that is switched on, complete and not blocked for that place.
 * Used to refuse a change that would leave the place with no way to sign in. The admin sign-in
 * always keeps its password, so it is never asked.
 */
export function placeHasWayIn(area: MatrixArea, matrix: AuthMatrix, settings: SecuritySettings, social: SocialConfig): boolean {
  if (methodAllowed(matrix, area, 'password')) return true
  if (settings.passwordless.magicLinkEnabled && methodAllowed(matrix, area, 'magic-link')) return true
  if (settings.passwordless.emailCodeEnabled && methodAllowed(matrix, area, 'email-code')) return true
  if (settings.passkeys.enabled && methodAllowed(matrix, area, 'passkeys')) return true
  return PROVIDER_IDS.some((id) => {
    const cfg = social.providers[id]
    return cfg.enabled && missingCredentials(id, cfg).length === 0 && methodAllowed(matrix, area, `social-${id}`)
  })
}

/** The settings patch that switches one method on or off, or null when the method has no switch. Social patches touch only that provider's flag. */
export function togglePatch(id: string, on: boolean): Record<string, unknown> | null {
  if (id === 'magic-link') return { magicLinkEnabled: on }
  if (id === 'email-code') return { emailCodeEnabled: on }
  if (id === 'passkeys') return { passkeysEnabled: on }
  if (id === 'username') return { usernameSignInEnabled: on }
  if (id === 'email-verification') return { emailVerificationRequired: on }
  if (id.startsWith('social-')) {
    const provider = id.slice('social-'.length)
    if ((GLOBAL_PROVIDER_IDS as readonly string[]).includes(provider)) return { socialLogin: { [`${provider}Enabled`]: on } }
  }
  return null
}
