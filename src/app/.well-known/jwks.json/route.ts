import { createD1SigningKeyStore, currentSigningKey, publishedKeys } from '@/features/apiKeys/tokens/signingKeys'
import { defaultTokenD1 } from '@/features/apiKeys/tokens/tables'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'

export const dynamic = 'force-dynamic'

/**
 * The public half of the keys that sign API access tokens, as a JSON Web Key Set. Public keys only.
 * Empty until API keys are switched on. Verifiers may cache it for five minutes.
 */
export async function GET(): Promise<Response> {
  const headers = { 'Content-Type': 'application/jwk-set+json; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' }
  try {
    const settings = await readSecuritySettingsFromD1()
    if (!settings.apiKeys.enabled) return new Response(JSON.stringify({ keys: [] }), { headers })
    const store = createD1SigningKeyStore(defaultTokenD1)
    await currentSigningKey(store, Date.now())
    return new Response(JSON.stringify({ keys: await publishedKeys(store, Date.now()) }), { headers })
  } catch {
    return new Response(JSON.stringify({ keys: [] }), { status: 503, headers: { ...headers, 'Cache-Control': 'no-store' } })
  }
}
