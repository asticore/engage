/**
 * The sign-in providers: endpoints, scopes and what each one needs before
 * it may be used. Plain data and pure helpers - no I/O - so the settings
 * screen, the routes and the tests all read the same facts.
 *
 * Six providers keep their settings on the Security settings page. The
 * others (X, LinkedIn, TikTok, Slack and the free-form `oidc` provider) keep
 * theirs in their own table (see extraStore.ts), because that page's table has
 * no room for more columns; they are set up on Settings > Security > More
 * sign-in providers.
 */

export const GLOBAL_PROVIDER_IDS = ['google', 'github', 'apple', 'facebook', 'microsoft', 'discord'] as const
export const EXTRA_PROVIDER_IDS = ['x', 'linkedin', 'tiktok', 'slack', 'oidc'] as const
export const PROVIDER_IDS = [...GLOBAL_PROVIDER_IDS, ...EXTRA_PROVIDER_IDS] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]
export type ExtraProviderId = (typeof EXTRA_PROVIDER_IDS)[number]

export const isExtraProviderId = (value: unknown): value is ExtraProviderId =>
  typeof value === 'string' && (EXTRA_PROVIDER_IDS as readonly string[]).includes(value)

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)

/** One provider's saved settings. Secrets are decrypted; server use only. */
export type ProviderConfig = {
  enabled: boolean
  clientId: string
  clientSecret: string
  teamId: string
  keyId: string
  privateKey: string
  tenant: string
  redirectConfirmed: boolean
  /** Free-form provider only: the button text. */
  label: string
  /** Free-form provider only: an OpenID Connect discovery address, or the three addresses below. */
  discoveryUrl: string
  authUrl: string
  tokenUrl: string
  userinfoUrl: string
  /** Free-form provider only: space separated. Empty means "openid email profile". */
  scopes: string
  /** Free-form provider only: which claims hold the subject, the email and whether it is verified. Empty means sub, email, email_verified. */
  subjectClaim: string
  emailClaim: string
  verifiedClaim: string
  /** Free-form provider only: treat the email as verified even when the provider sends no verified claim. */
  trustEmail: boolean
}

export type SocialConfig = {
  allowSignupViaSocial: boolean
  allowAdminSocialLogin: boolean
  /** Show Google's One Tap prompt on the member sign-in page. Needs Google switched on. */
  googleOneTap: boolean
  providers: Record<ProviderId, ProviderConfig>
  /** Providers the owner blocked per sign-in place (Who can sign in with what). Empty means nothing blocked. */
  blocked?: { admin: string[]; account: string[] }
}

export type OidcInfo = {
  jwksUrl: string
  /** True when the token's `iss` claim is acceptable for this provider and config. */
  issuerOk: (iss: string, claims: Record<string, unknown>, cfg: ProviderConfig) => boolean
}

export type ProviderDef = {
  id: ProviderId
  label: string
  scopes: string[]
  pkce: boolean
  oidc: OidcInfo | null
  authUrl: (cfg: ProviderConfig) => string
  tokenUrl: (cfg: ProviderConfig) => string
  /** Extra authorize-URL parameters. */
  authParams: Record<string, string>
  /** Name of the client id parameter (TikTok calls it client_key). */
  clientIdParam?: string
  /** How the client secret reaches the token endpoint. Default: in the form body. */
  clientAuth?: 'body' | 'basic'
  /** Separator between scopes in the authorize URL. Default: a space. */
  scopeSeparator?: string
}

const MS_PERSONAL_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

export const DEFAULT_MICROSOFT_TENANT = 'common'

/** A tenant is "common", "organizations", "consumers", a GUID or a domain - never anything that could alter the URL path. */
export const safeTenant = (value: string): string => {
  const tenant = (value || '').trim()
  return /^[A-Za-z0-9.-]{1,100}$/.test(tenant) ? tenant : DEFAULT_MICROSOFT_TENANT
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  google: {
    id: 'google',
    label: 'Google',
    scopes: ['openid', 'email', 'profile'],
    pkce: true,
    oidc: {
      jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
      issuerOk: (iss) => iss === 'https://accounts.google.com' || iss === 'accounts.google.com',
    },
    authUrl: () => 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: () => 'https://oauth2.googleapis.com/token',
    authParams: { prompt: 'select_account' },
  },
  github: {
    id: 'github',
    label: 'GitHub',
    scopes: ['read:user', 'user:email'],
    pkce: true,
    oidc: null,
    authUrl: () => 'https://github.com/login/oauth/authorize',
    tokenUrl: () => 'https://github.com/login/oauth/access_token',
    authParams: {},
  },
  apple: {
    id: 'apple',
    label: 'Apple',
    scopes: ['name', 'email'],
    // Apple's PKCE support is not documented; state + nonce + the signed cookie cover the same ground.
    pkce: false,
    oidc: {
      jwksUrl: 'https://appleid.apple.com/auth/keys',
      issuerOk: (iss) => iss === 'https://appleid.apple.com',
    },
    authUrl: () => 'https://appleid.apple.com/auth/authorize',
    tokenUrl: () => 'https://appleid.apple.com/auth/token',
    authParams: { response_mode: 'form_post' },
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    scopes: ['email', 'public_profile'],
    pkce: false,
    oidc: null,
    authUrl: () => 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: () => 'https://graph.facebook.com/v19.0/oauth/access_token',
    authParams: {},
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft',
    scopes: ['openid', 'email', 'profile'],
    pkce: true,
    oidc: {
      jwksUrl: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
      // The issuer carries the signing tenant's id, which is in the token's own `tid`. A fixed tenant must match it.
      issuerOk: (iss, claims, cfg) => {
        const tid = typeof claims.tid === 'string' ? claims.tid : ''
        if (!tid || iss !== `https://login.microsoftonline.com/${tid}/v2.0`) return false
        const tenant = safeTenant(cfg.tenant).toLowerCase()
        if (tenant === 'common') return true
        if (tenant === 'organizations') return tid !== MS_PERSONAL_TENANT
        if (tenant === 'consumers') return tid === MS_PERSONAL_TENANT
        return tid.toLowerCase() === tenant
      },
    },
    authUrl: (cfg) => `https://login.microsoftonline.com/${safeTenant(cfg.tenant)}/oauth2/v2.0/authorize`,
    tokenUrl: (cfg) => `https://login.microsoftonline.com/${safeTenant(cfg.tenant)}/oauth2/v2.0/token`,
    authParams: { prompt: 'select_account' },
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    scopes: ['identify', 'email'],
    pkce: true,
    oidc: null,
    authUrl: () => 'https://discord.com/oauth2/authorize',
    tokenUrl: () => 'https://discord.com/api/oauth2/token',
    authParams: {},
  },
  x: {
    id: 'x',
    label: 'X',
    scopes: ['users.read', 'tweet.read', 'users.email'],
    pkce: true,
    oidc: null,
    authUrl: () => 'https://x.com/i/oauth2/authorize',
    tokenUrl: () => 'https://api.x.com/2/oauth2/token',
    authParams: {},
    clientAuth: 'basic',
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    scopes: ['openid', 'profile', 'email'],
    pkce: false,
    oidc: {
      jwksUrl: 'https://www.linkedin.com/oauth/openid/jwks',
      issuerOk: (iss) => iss === 'https://www.linkedin.com/oauth',
    },
    authUrl: () => 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: () => 'https://www.linkedin.com/oauth/v2/accessToken',
    authParams: {},
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    scopes: ['user.info.basic'],
    pkce: false,
    oidc: null,
    authUrl: () => 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: () => 'https://open.tiktokapis.com/v2/oauth/token/',
    authParams: {},
    clientIdParam: 'client_key',
    scopeSeparator: ',',
  },
  slack: {
    id: 'slack',
    label: 'Slack',
    scopes: ['openid', 'email', 'profile'],
    pkce: false,
    oidc: {
      jwksUrl: 'https://slack.com/openid/connect/keys',
      issuerOk: (iss) => iss === 'https://slack.com',
    },
    authUrl: () => 'https://slack.com/openid/connect/authorize',
    tokenUrl: () => 'https://slack.com/api/openid.connect.token',
    authParams: {},
  },
  oidc: {
    id: 'oidc',
    label: 'Single sign-on',
    scopes: ['openid', 'email', 'profile'],
    pkce: true,
    // Endpoints, keys and issuer come from the discovery document (see endpoints.ts).
    oidc: null,
    authUrl: (cfg) => cfg.authUrl,
    tokenUrl: (cfg) => cfg.tokenUrl,
    authParams: {},
  },
}

export { MS_PERSONAL_TENANT }

export const emptyProviderConfig = (): ProviderConfig => ({
  enabled: false,
  clientId: '',
  clientSecret: '',
  teamId: '',
  keyId: '',
  privateKey: '',
  tenant: DEFAULT_MICROSOFT_TENANT,
  redirectConfirmed: false,
  label: '',
  discoveryUrl: '',
  authUrl: '',
  tokenUrl: '',
  userinfoUrl: '',
  scopes: '',
  subjectClaim: '',
  emailClaim: '',
  verifiedClaim: '',
  trustEmail: false,
})

export const emptySocialConfig = (): SocialConfig => ({
  allowSignupViaSocial: true,
  allowAdminSocialLogin: false,
  googleOneTap: false,
  providers: Object.fromEntries(PROVIDER_IDS.map((id) => [id, emptyProviderConfig()])) as Record<ProviderId, ProviderConfig>,
})

/** The credentials a provider cannot work without, as [settings key, plain label]. */
export const REQUIRED_CREDENTIALS: Record<ProviderId, Array<[keyof ProviderConfig, string]>> = {
  google: [['clientId', 'client ID'], ['clientSecret', 'client secret']],
  github: [['clientId', 'client ID'], ['clientSecret', 'client secret']],
  facebook: [['clientId', 'app ID'], ['clientSecret', 'app secret']],
  discord: [['clientId', 'client ID'], ['clientSecret', 'client secret']],
  microsoft: [['clientId', 'application (client) ID'], ['clientSecret', 'client secret value']],
  apple: [['clientId', 'Services ID'], ['teamId', 'Team ID'], ['keyId', 'Key ID'], ['privateKey', 'private key (.p8)']],
  x: [['clientId', 'client ID'], ['clientSecret', 'client secret']],
  linkedin: [['clientId', 'client ID'], ['clientSecret', 'primary client secret']],
  tiktok: [['clientId', 'client key'], ['clientSecret', 'client secret']],
  slack: [['clientId', 'client ID'], ['clientSecret', 'client secret']],
  oidc: [['clientId', 'client ID'], ['clientSecret', 'client secret']],
}

/** Plain-English names of the credentials still missing for a provider. Empty means complete. */
export const missingCredentials = (id: ProviderId, cfg: ProviderConfig): string[] => {
  const missing = REQUIRED_CREDENTIALS[id].filter(([key]) => !String(cfg[key] ?? '').trim()).map(([, label]) => label)
  // The free-form provider also needs somewhere to send people: a discovery address, or both endpoints.
  if (id === 'oidc' && !cfg.discoveryUrl.trim() && !(cfg.authUrl.trim() && cfg.tokenUrl.trim())) {
    missing.push('discovery URL (or the authorize and token URLs)')
  }
  return missing
}

/** What the button says. The free-form provider uses the owner's own text. */
export const providerLabel = (id: ProviderId, cfg?: Pick<ProviderConfig, 'label'>): string =>
  id === 'oidc' && cfg?.label.trim() ? cfg.label.trim().slice(0, 40) : PROVIDERS[id].label

/** The scopes a provider is asked for. The free-form provider uses the owner's list when there is one. */
export const scopesFor = (id: ProviderId, cfg: Pick<ProviderConfig, 'scopes'>): string[] => {
  const custom = id === 'oidc' ? cfg.scopes.split(/[\s,]+/).filter(Boolean).slice(0, 20) : []
  return custom.length > 0 ? custom : PROVIDERS[id].scopes
}

/** True when the provider answers with an ID token to verify (and so a nonce is sent). */
export const usesIdToken = (id: ProviderId, cfg: Pick<ProviderConfig, 'scopes'>): boolean =>
  PROVIDERS[id].oidc !== null || (id === 'oidc' && scopesFor(id, cfg).includes('openid'))

export const hasCredentials = (id: ProviderId, cfg: ProviderConfig): boolean => missingCredentials(id, cfg).length === 0

/** Fail closed: usable only when switched on AND every credential is saved. */
export const isUsable = (id: ProviderId, cfg: ProviderConfig): boolean => cfg.enabled === true && hasCredentials(id, cfg)

/** The exact callback address to register with the provider for a site origin. */
export const redirectUriFor = (origin: string, id: ProviderId): string => `${origin.replace(/\/+$/, '')}/api/social/${id}/callback`
