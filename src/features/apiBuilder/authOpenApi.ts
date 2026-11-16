import type { GuideOptions } from './devguide'

/**
 * An OpenAPI 3.1 description of the sign-in side of the API: password sign-in and sessions, two-step,
 * emailed links and codes, passkeys, social sign-in, Google One Tap, and API keys with access tokens
 * and one-time tokens. It is written by hand from the routes in `src/localapi/rest.ts`, `src/app/(engage)/api/`
 * and `src/features/accounts/*Http.ts`, and a test fails when a documented path is missing from it
 * or a route listed in `AUTH_ROUTES` is not described. The base URL is the request's own origin; no key
 * or secret is ever written in.
 */

type Json = Record<string, unknown>

const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` })
const body = (schema: Json): Json => ({ required: true, content: { 'application/json': { schema } } })
const ok = (description: string, schema?: Json): Json => ({ description, ...(schema ? { content: { 'application/json': { schema } } } : {}) })
const error = (description: string): Json => ({ description, content: { 'application/json': { schema: ref('Error') } } })
const str = (description?: string): Json => ({ type: 'string', ...(description ? { description } : {}) })
const obj = (properties: Json, required: string[] = []): Json => ({ type: 'object', properties, ...(required.length ? { required } : {}) })
const area = { name: 'area', in: 'query', required: false, description: 'Which sign-in screen: the member screen or the admin screen.', schema: { type: 'string', enum: ['account', 'admin'] } }

const none: Json[] = []
const key: Json[] = [{ ApiKey: [] }]
const session: Json[] = [{ SessionCookie: [] }]

/** Every operation as [method, path]. Exported so the test can compare it with the route files. */
export const AUTH_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['post', '/api/users/login'],
  ['post', '/api/users/login-2fa'],
  ['post', '/api/users/login-2fa-email'],
  ['post', '/api/users/logout'],
  ['post', '/api/users/refresh-token'],
  ['post', '/api/users/forgot-password'],
  ['post', '/api/users/reset-password'],
  ['post', '/api/users/unlock'],
  ['get', '/api/users/me'],
  ['get', '/api/passwordless/options'],
  ['post', '/api/passwordless/request'],
  ['post', '/api/passwordless/verify'],
  ['get', '/api/passkeys/availability'],
  ['get', '/api/passkeys/list'],
  ['post', '/api/passkeys/register-options'],
  ['post', '/api/passkeys/register-verify'],
  ['post', '/api/passkeys/login-options'],
  ['post', '/api/passkeys/login-verify'],
  ['post', '/api/passkeys/rename'],
  ['post', '/api/passkeys/remove'],
  ['get', '/api/social/providers'],
  ['get', '/api/social/{provider}/start'],
  ['get', '/api/social/{provider}/callback'],
  ['get', '/api/social/pending'],
  ['get', '/api/social/one-tap'],
  ['post', '/api/social/one-tap'],
  ['post', '/api/auth/token'],
  ['post', '/api/auth/one-time-token'],
  ['post', '/api/auth/one-time-token/verify'],
  ['get', '/.well-known/jwks.json'],
]

export function buildAuthOpenApi(options: GuideOptions): Json {
  const loginResult = ok(
    'Signed in. The session token is also set as the HttpOnly cookie `engage-token`.',
    obj({ message: str(), user: ref('User'), token: str('Session token. Prefer the cookie in a browser.'), exp: { type: 'integer', description: 'Unix time the session ends.' } }),
  )
  const stepUp = ok('The password was right but a second step is needed, or the sign-in is complete.', ref('SignInResult'))
  const limited = error('Too many attempts. See the Retry-After header.')
  const sameSite = error('Refused: the request did not come from this site, or the feature is off.')

  const paths: Record<string, Json> = {
    '/api/users/login': {
      post: {
        operationId: 'login', tags: ['Sessions'], summary: 'Sign in with email and password', security: none,
        requestBody: body(obj({ email: str(), password: str() }, ['email', 'password'])),
        responses: {
          '200': loginResult,
          '401': error('Wrong email or password.'), '423': error('The account is locked after too many wrong passwords.'), '429': limited,
        },
        description: 'When two-step sign-in is required the response is `{ twoFactorRequired: true, pendingToken }` instead; finish it at `/api/users/login-2fa`.',
      },
    },
    '/api/users/login-2fa': {
      post: {
        operationId: 'loginSecondFactor', tags: ['Two-step'], summary: 'Finish a two-step sign-in with an authenticator or backup code', security: none,
        requestBody: body(obj({ pendingToken: str(), code: str(), method: { type: 'string', enum: ['totp', 'backup', 'email'], description: 'Optional. `email` checks the code emailed by `login-2fa-email`.' } }, ['pendingToken', 'code'])),
        responses: { '200': loginResult, '401': error('The code is wrong or the pending sign-in expired.'), '423': error('Locked.'), '429': limited },
      },
    },
    '/api/users/login-2fa-email': {
      post: {
        operationId: 'sendSecondFactorEmail', tags: ['Two-step'], summary: 'Email the second-step code for a pending sign-in', security: none,
        requestBody: body(obj({ pendingToken: str() }, ['pendingToken'])),
        responses: { '200': ok('Sent, if the account allows email codes.'), '429': limited },
      },
    },
    '/api/users/logout': {
      post: {
        operationId: 'logout', tags: ['Sessions'], summary: 'End this session, or every session', security: session,
        requestBody: { required: false, content: { 'application/json': { schema: obj({ allSessions: { type: 'boolean', description: 'End the session on every device.' } }) } } },
        responses: { '200': ok('Signed out. The cookie is cleared.', obj({ message: str() })) },
      },
    },
    '/api/users/refresh-token': {
      post: {
        operationId: 'refreshSession', tags: ['Sessions'], summary: 'Extend the current session', security: session,
        responses: { '200': ok('A fresh session token (also set as a cookie).', obj({ message: str(), exp: { type: 'integer' }, refreshedToken: str(), user: ref('User') })), '401': error('No valid session.') },
      },
    },
    '/api/users/forgot-password': {
      post: {
        operationId: 'forgotPassword', tags: ['Password'], summary: 'Email a password reset link', security: none,
        description: 'Always answers 200, whether or not the address has an account, so it cannot be used to find out who has one.',
        requestBody: body(obj({ email: str() }, ['email'])),
        responses: { '200': ok('Success.', obj({ message: str() })), '429': limited },
      },
    },
    '/api/users/reset-password': {
      post: {
        operationId: 'resetPassword', tags: ['Password'], summary: 'Set a new password with a reset token', security: none,
        requestBody: body(obj({ token: str('From the emailed link.'), password: str() }, ['token', 'password'])),
        responses: { '200': loginResult, '400': error('The token is invalid or expired, or the password breaks the rules.') },
      },
    },
    '/api/users/unlock': {
      post: {
        operationId: 'unlockAccount', tags: ['Password'], summary: 'Unlock an account locked by wrong passwords', security: session,
        requestBody: body(obj({ email: str() }, ['email'])),
        responses: { '200': ok('Success.', obj({ message: str() })), '401': error('Not allowed.') },
      },
    },
    '/api/users/me': {
      get: {
        operationId: 'me', tags: ['Sessions'], summary: 'The signed-in account', security: [...session, ...key, { AccessToken: [] }],
        responses: { '200': ok('The account, or `user: null` when nobody is signed in.', obj({ user: { oneOf: [ref('User'), { type: 'null' }] } })) },
      },
    },
    '/api/passwordless/options': {
      get: {
        operationId: 'passwordlessOptions', tags: ['Email link and code'], summary: 'Which emailed sign-in options are on', security: none, parameters: [area],
        responses: { '200': ok('Switches only.', obj({ magicLink: { type: 'boolean' }, emailCode: { type: 'boolean' } })) },
      },
    },
    '/api/passwordless/request': {
      post: {
        operationId: 'passwordlessRequest', tags: ['Email link and code'], summary: 'Ask for an emailed sign-in link or six-digit code', security: none,
        description: 'The answer is the same for any address.',
        requestBody: body(obj({ email: str(), kind: { type: 'string', enum: ['link', 'code'] }, next: str('Path to land on after sign-in.') }, ['email'])),
        responses: { '200': ok('Asked.', ref('Ok')), '400': error('Not available.'), '403': sameSite, '429': limited },
      },
    },
    '/api/passwordless/verify': {
      post: {
        operationId: 'passwordlessVerify', tags: ['Email link and code'], summary: 'Exchange an emailed six-digit code for a session', security: none,
        requestBody: body(obj({ email: str(), code: str(), next: str() }, ['email', 'code'])),
        responses: { '200': stepUp, '400': error('Wrong or expired code.'), '403': sameSite, '429': limited },
      },
    },
    '/api/passkeys/availability': {
      get: { operationId: 'passkeyAvailability', tags: ['Passkeys'], summary: 'Whether passkey sign-in is offered', security: none, parameters: [area], responses: { '200': ok('Switch state.', obj({ enabled: { type: 'boolean' } })) } },
    },
    '/api/passkeys/list': {
      get: { operationId: 'passkeyList', tags: ['Passkeys'], summary: "The signed-in person's passkeys", security: session, responses: { '200': ok('Passkeys (never key material).', obj({ ok: { type: 'boolean' }, enabled: { type: 'boolean' }, passkeys: { type: 'array', items: ref('Passkey') } })), '401': error('Signed out.') } },
    },
    '/api/passkeys/register-options': {
      post: { operationId: 'passkeyRegisterOptions', tags: ['Passkeys'], summary: 'WebAuthn creation options for a new passkey', security: session, responses: { '200': ok('Options to pass to `navigator.credentials.create`.', obj({ ok: { type: 'boolean' }, options: { type: 'object' } })), '401': error('Signed out.'), '403': sameSite } },
    },
    '/api/passkeys/register-verify': {
      post: {
        operationId: 'passkeyRegisterVerify', tags: ['Passkeys'], summary: 'Check the new credential and store its public key', security: session,
        requestBody: body({ type: 'object', description: 'The WebAuthn attestation response, as returned by `navigator.credentials.create`, plus an optional `label`.' }),
        responses: { '200': ok('Stored.', obj({ ok: { type: 'boolean' }, id: { type: 'integer' }, passkeys: { type: 'array', items: ref('Passkey') } })), '400': error('Not accepted.'), '429': limited },
      },
    },
    '/api/passkeys/login-options': {
      post: { operationId: 'passkeyLoginOptions', tags: ['Passkeys'], summary: 'WebAuthn request options for a passkey sign-in', security: none, responses: { '200': ok('Options to pass to `navigator.credentials.get`.', obj({ ok: { type: 'boolean' }, options: { type: 'object' } })), '403': sameSite, '429': limited } },
    },
    '/api/passkeys/login-verify': {
      post: {
        operationId: 'passkeyLoginVerify', tags: ['Passkeys'], summary: 'Check a passkey sign-in and start the session', security: none,
        requestBody: body({ type: 'object', description: 'The WebAuthn assertion response, plus optional `next` and `area`.' }),
        responses: { '200': ok('Signed in (`redirect`), or a second step is needed (`twoFactorRequired`, `pendingToken`).', ref('SignInResult')), '400': error('Not accepted.'), '429': limited },
      },
    },
    '/api/passkeys/rename': {
      post: { operationId: 'passkeyRename', tags: ['Passkeys'], summary: 'Rename a passkey', security: session, requestBody: body(obj({ id: { type: 'integer' }, label: str() }, ['id', 'label'])), responses: { '200': ok('Renamed.', ref('Ok')), '400': error('Not accepted.') } },
    },
    '/api/passkeys/remove': {
      post: { operationId: 'passkeyRemove', tags: ['Passkeys'], summary: 'Remove a passkey', security: session, requestBody: body(obj({ id: { type: 'integer' }, password: str('Needed when removing the last way in.'), code: str('Second-step code, when required.') }, ['id'])), responses: { '200': ok('Removed.', ref('Ok')), '400': error('Not accepted.') } },
    },
    '/api/social/providers': {
      get: { operationId: 'socialProviders', tags: ['Social sign-in'], summary: 'Which provider buttons to show', security: none, parameters: [area], responses: { '200': ok('Names only, never credentials.', obj({ providers: { type: 'array', items: obj({ id: str(), label: str() }) } })) } },
    },
    '/api/social/{provider}/start': {
      get: {
        operationId: 'socialStart', tags: ['Social sign-in'], summary: 'Begin a provider sign-in, link or admin test', security: none,
        description: 'A browser flow: redirects (303) to the provider. Providers: google, github, apple, facebook, microsoft, discord, x, linkedin, tiktok, slack and oidc (the free-form provider). 404 when the provider is off.',
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google', 'github', 'apple', 'facebook', 'microsoft', 'discord', 'x', 'linkedin', 'tiktok', 'slack', 'oidc'] } },
          { name: 'mode', in: 'query', required: false, schema: { type: 'string', enum: ['signin', 'link', 'test'] } },
          area,
          { name: 'next', in: 'query', required: false, description: 'A path on this site to land on afterwards.', schema: { type: 'string' } },
        ],
        responses: { '303': { description: 'Redirect to the provider.' }, '404': error('The provider is off.') },
      },
    },
    '/api/social/{provider}/callback': {
      get: {
        operationId: 'socialCallback', tags: ['Social sign-in'], summary: 'The provider sends the person back here', security: none,
        description: 'A browser flow. Checks the signed state cookie, the code exchange and the ID token, applies the account rules, then redirects (303). Apple answers with a form POST to the same address, which is bounced to a GET.',
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }, { name: 'code', in: 'query', schema: { type: 'string' } }, { name: 'state', in: 'query', schema: { type: 'string' } }],
        responses: { '303': { description: 'Redirect to the account, the admin, the second step, or back to sign-in with `social_error`.' } },
      },
    },
    '/api/social/pending': {
      get: { operationId: 'socialPending', tags: ['Social sign-in'], summary: 'Pick up a pending second-step token after a social sign-in', security: none, responses: { '200': ok('The token (or null). It still needs a code and lives five minutes.', obj({ pendingToken: { type: ['string', 'null'] } })) } },
    },
    '/api/social/one-tap': {
      get: {
        operationId: 'oneTapStart', tags: ['Social sign-in'], summary: 'What Google One Tap needs', security: none,
        parameters: [{ name: 'next', in: 'query', schema: { type: 'string' } }],
        responses: { '200': ok('The public client ID, a nonce and a state value; the state is also kept in a signed cookie.', obj({ ok: { type: 'boolean' }, clientId: str(), nonce: str(), state: str() })), '404': error('One Tap is off.'), '429': limited },
      },
      post: {
        operationId: 'oneTapSignIn', tags: ['Social sign-in'], summary: 'Sign in with the credential Google One Tap returned', security: none,
        description: 'Same-origin only (the Origin header must match). The same account rules as the Google button.',
        requestBody: body(obj({ credential: str('Google ID token.'), state: str() }, ['credential', 'state'])),
        responses: { '200': ok('Signed in; `redirect` says where to go.', obj({ ok: { type: 'boolean' }, redirect: str() })), '400': error('Not accepted (`code` says why).'), '403': sameSite, '429': limited },
      },
    },
    '/api/auth/token': {
      post: {
        operationId: 'exchangeApiKey', tags: ['API keys and tokens'], summary: 'Trade an API key for a short-lived access token', security: key,
        description: 'Send the key as `Authorization: Bearer egk_...`. The token counts as its key on every request, so revoking the key stops it at once. A token cannot be exchanged for another.',
        requestBody: { required: false, content: { 'application/json': { schema: ref('TokenRequest') }, 'application/x-www-form-urlencoded': { schema: ref('TokenRequest') } } },
        responses: { '200': ok('Issued.', ref('TokenResponse')), '400': error('`invalid_scope`.'), '401': error('`invalid_client`: no key, a token instead of a key, or a key that is not valid.'), '429': error('`slow_down`.') },
      },
    },
    '/api/auth/one-time-token': {
      post: {
        operationId: 'createOneTimeToken', tags: ['API keys and tokens'], summary: 'Make a one-time token for a link or handoff', security: key,
        description: 'Staff keys only. The token works once, for the purpose it was made for.',
        requestBody: body(obj({ purpose: str('Up to 35 characters: letters, numbers, colon, dash, underscore.'), expires_in: { type: 'integer', minimum: 1, maximum: 3600, default: 300 }, payload: { description: 'Any JSON up to 1 KB, handed back when the token is used.' } }, ['purpose'])),
        responses: { '201': ok('Made. The token is shown once.', obj({ token: str(), purpose: str(), expires_at: str() })), '400': error('`invalid_request`.'), '403': error('`access_denied`: not a staff key.'), '401': error('`invalid_client`.') },
      },
    },
    '/api/auth/one-time-token/verify': {
      post: {
        operationId: 'useOneTimeToken', tags: ['API keys and tokens'], summary: 'Use a one-time token up', security: key,
        requestBody: body(obj({ token: str(), purpose: str() }, ['token', 'purpose'])),
        responses: { '200': ok('Valid, and now used.', obj({ valid: { type: 'boolean' }, purpose: str(), subject: { type: ['integer', 'null'], description: 'Id of the account that made it.' }, payload: {}, issued_at: str() })), '404': ok('Unknown, wrong purpose, expired or already used.', obj({ valid: { type: 'boolean' } })), '403': error('`access_denied`.'), '401': error('`invalid_client`.') },
      },
    },
    '/.well-known/jwks.json': {
      get: { operationId: 'jwks', tags: ['API keys and tokens'], summary: 'Public keys that verify access tokens', security: none, description: 'Public halves only (ES256). Empty while API keys are off. Cache for five minutes.', responses: { '200': ok('A JSON Web Key Set.', ref('Jwks')) } },
    },
  }

  return {
    openapi: '3.1.0',
    info: {
      title: `${options.siteName} authentication API`,
      version: '1.0.0',
      description:
        'Sign-in, sessions, two-step, emailed links and codes, passkeys, social sign-in, API keys and access tokens. Browser flows (passkeys, social, One Tap) are included so a client can see what each endpoint expects; they are meant for the site\'s own pages. Generated ' + options.generatedAt + '.',
    },
    servers: [{ url: options.baseUrl }],
    tags: ['Sessions', 'Two-step', 'Password', 'Email link and code', 'Passkeys', 'Social sign-in', 'API keys and tokens'].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        SessionCookie: { type: 'apiKey', in: 'cookie', name: 'engage-token', description: 'The HttpOnly session cookie set at sign-in.' },
        ApiKey: { type: 'http', scheme: 'bearer', description: 'A per-user API key, `egk_...`. Also accepted as the `x-api-key` header.' },
        AccessToken: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'A short-lived ES256 access token from `POST /api/auth/token`. Verify with the keys at `/.well-known/jwks.json`.' },
      },
      schemas: {
        Error: obj({ errors: { type: 'array', items: obj({ name: str(), message: str() }) }, error: str(), error_description: str(), ok: { type: 'boolean' }, message: str() }),
        Ok: obj({ ok: { type: 'boolean' }, message: str() }),
        User: obj({ id: { type: 'integer' }, email: str(), roles: { type: 'array', items: str() } }),
        SignInResult: obj({ ok: { type: 'boolean' }, redirect: str(), twoFactorRequired: { type: 'boolean' }, pendingToken: str() }),
        Passkey: obj({ id: { type: 'integer' }, label: str(), createdAt: str(), lastUsedAt: { type: ['string', 'null'] } }),
        TokenRequest: obj({ scope: str('Space separated `collection:action` scopes, narrowing the key. Default: all the key scopes.'), expires_in: { type: 'integer', minimum: 60, maximum: 3600, default: 900 } }),
        TokenResponse: obj({ access_token: str(), token_type: { type: 'string', enum: ['Bearer'] }, expires_in: { type: 'integer' }, scope: str() }, ['access_token', 'token_type', 'expires_in']),
        Jwks: obj({ keys: { type: 'array', items: obj({ kty: str(), crv: str(), x: str(), y: str(), kid: str(), alg: str(), use: str() }) } }, ['keys']),
      },
    },
  }
}
