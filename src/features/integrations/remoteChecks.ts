/**
 * Read-only connection checks for the Integrations page: each one asks the
 * provider a question that changes nothing and costs nothing (a model list, a
 * zone lookup). Server only. Keys are passed in, never logged, and never
 * returned in a result.
 */

export type CheckResult = { ok: boolean; message: string }

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

const TIMEOUT_MS = 8000

const withTimeout = (init: RequestInit = {}): RequestInit => ({ ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })

async function describeFailure(response: Response): Promise<string> {
  const body = (await response.json().catch((): null => null)) as { error?: { message?: string }; errors?: Array<{ message?: string }> } | null
  const detail = body?.error?.message ?? body?.errors?.[0]?.message
  return detail ? ` (${detail})` : ''
}

/** Checks the saved Claude and OpenAI keys against each provider's model list. */
export async function checkAiKeys(
  keys: { claude?: string | null; openai?: string | null },
  fetcher: Fetcher = fetch,
): Promise<{ claude: CheckResult; openai: CheckResult }> {
  const claude = keys.claude?.trim()
    ? await fetcher(
        'https://api.anthropic.com/v1/models',
        withTimeout({ headers: { 'x-api-key': keys.claude.trim(), 'anthropic-version': '2023-06-01' } }),
      )
        .then(async (response) =>
          response.ok
            ? { ok: true, message: 'Claude key accepted.' }
            : { ok: false, message: `Anthropic refused this key (HTTP ${response.status})${await describeFailure(response)}.` },
        )
        .catch((): CheckResult => ({ ok: false, message: 'Could not reach Anthropic. Try again in a moment.' }))
    : { ok: false, message: 'No Claude key saved yet.' }

  const openai = keys.openai?.trim()
    ? await fetcher('https://api.openai.com/v1/models', withTimeout({ headers: { Authorization: `Bearer ${keys.openai.trim()}` } }))
        .then(async (response) =>
          response.ok
            ? { ok: true, message: 'OpenAI key accepted.' }
            : { ok: false, message: `OpenAI refused this key (HTTP ${response.status})${await describeFailure(response)}.` },
        )
        .catch((): CheckResult => ({ ok: false, message: 'Could not reach OpenAI. Try again in a moment.' }))
    : { ok: false, message: 'No OpenAI key saved yet.' }

  return { claude, openai }
}

/** Looks up the saved Cloudflare zone with the saved API token. */
export async function checkCloudflareZone(
  config: { zoneId?: string | null; apiToken?: string | null },
  fetcher: Fetcher = fetch,
): Promise<CheckResult> {
  const zoneId = config.zoneId?.trim() ?? ''
  const token = config.apiToken?.trim() ?? ''
  if (!zoneId || !token) return { ok: false, message: 'Save the zone ID and API token first.' }
  if (!/^[a-f0-9]{32}$/i.test(zoneId)) return { ok: false, message: 'The zone ID should be 32 letters and digits, from the zone overview page.' }
  try {
    const response = await fetcher(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, withTimeout({ headers: { Authorization: `Bearer ${token}` } }))
    const body = (await response.json().catch((): null => null)) as { success?: boolean; result?: { name?: string }; errors?: Array<{ message?: string }> } | null
    if (response.ok && body?.success) {
      return { ok: true, message: `Connected to the zone ${body.result?.name ?? zoneId}.` }
    }
    return { ok: false, message: `Cloudflare did not accept the zone or token${body?.errors?.[0]?.message ? ` (${body.errors[0].message})` : ''}.` }
  } catch {
    return { ok: false, message: 'Could not reach Cloudflare. Try again in a moment.' }
  }
}

/**
 * Format of a Google API key (browser or server): "AIza" then 35 letters, digits, "-" or "_".
 * Offline. A website-restricted key cannot be tested from the server (Google refuses the call
 * because it has no referrer), so the Maps key is checked by shape only.
 */
const GOOGLE_KEY = /^AIza[0-9A-Za-z_-]{35}$/

export function checkGoogleKeyShape(key: string | null | undefined, label: string): CheckResult {
  const value = key?.trim() ?? ''
  if (!value) return { ok: false, message: `No ${label} saved yet.` }
  if (!GOOGLE_KEY.test(value)) {
    return { ok: false, message: `The ${label} does not have the shape Google uses (it starts with AIza and is 39 characters). Copy it again from Google Cloud Console.` }
  }
  return {
    ok: true,
    message: `The ${label} has the shape Google uses. Nothing was sent to Google, because a website-restricted key only works from your site.`,
  }
}

/**
 * Asks PageSpeed Insights for a test with no page address. Google checks the key before the
 * address, so the answer tells the key apart without running (or using quota for) a test.
 */
export async function checkPageSpeedKey(key: string | null | undefined, fetcher: Fetcher = fetch): Promise<CheckResult> {
  const value = key?.trim() ?? ''
  if (!value) return { ok: false, message: 'No PageSpeed Insights key saved yet. Speed tests still work, with a smaller shared limit.' }
  try {
    const response = await fetcher(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?key=${encodeURIComponent(value)}`, withTimeout())
    if (response.ok) return { ok: true, message: 'PageSpeed Insights key accepted.' }
    const body = (await response.json().catch((): null => null)) as { error?: { message?: string } } | null
    const detail = body?.error?.message ?? ''
    if (response.status === 400 && /key/i.test(detail)) return { ok: false, message: `Google refused this key (${detail}).` }
    if (response.status === 400 && /missing required parameter/i.test(detail)) return { ok: true, message: 'PageSpeed Insights key accepted.' }
    return { ok: false, message: `PageSpeed Insights answered HTTP ${response.status}${detail ? ` (${detail})` : ''}. Check that the PageSpeed Insights API is enabled for the key's project.` }
  } catch {
    return { ok: false, message: 'Could not reach Google. Try again in a moment.' }
  }
}

/**
 * reCAPTCHA. The site key is public and only has a shape to check. The secret key is checked with
 * siteverify and a made-up response token: Google answers "invalid-input-response" for a good secret
 * and "invalid-input-secret" for a bad one. No visitor token is needed and nothing is recorded.
 */
const RECAPTCHA_SITE_KEY = /^6L[A-Za-z0-9_-]{30,60}$/

export async function checkRecaptchaKeys(
  keys: { siteKey?: string | null; secretKey?: string | null },
  fetcher: Fetcher = fetch,
): Promise<{ siteKey: CheckResult; secretKey: CheckResult }> {
  const siteValue = keys.siteKey?.trim() ?? ''
  const siteKey: CheckResult = !siteValue
    ? { ok: false, message: 'No reCAPTCHA site key saved yet.' }
    : RECAPTCHA_SITE_KEY.test(siteValue)
      ? { ok: true, message: 'The reCAPTCHA site key has the shape Google uses. It is public, so nothing was sent to Google.' }
      : { ok: false, message: 'The reCAPTCHA site key should start with 6L. Copy it again from google.com/recaptcha/admin.' }

  const secret = keys.secretKey?.trim() ?? ''
  if (!secret) return { siteKey, secretKey: { ok: false, message: 'No reCAPTCHA secret key saved yet.' } }
  try {
    const response = await fetcher('https://www.google.com/recaptcha/api/siteverify', {
      ...withTimeout(),
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: 'connection-check' }).toString(),
    })
    const body = (await response.json().catch((): null => null)) as { 'error-codes'?: string[] } | null
    const codes = Array.isArray(body?.['error-codes']) ? body['error-codes'] : []
    if (codes.includes('invalid-input-secret')) return { siteKey, secretKey: { ok: false, message: 'Google does not recognise this reCAPTCHA secret key.' } }
    if (codes.includes('missing-input-secret')) return { siteKey, secretKey: { ok: false, message: 'No reCAPTCHA secret key saved yet.' } }
    if (response.ok && body) return { siteKey, secretKey: { ok: true, message: 'reCAPTCHA secret key accepted. Nothing was verified for a visitor.' } }
    return { siteKey, secretKey: { ok: false, message: `Google answered HTTP ${response.status}. Try again in a moment.` } }
  } catch {
    return { siteKey, secretKey: { ok: false, message: 'Could not reach Google. Try again in a moment.' } }
  }
}
