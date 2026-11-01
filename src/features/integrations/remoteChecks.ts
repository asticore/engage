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
