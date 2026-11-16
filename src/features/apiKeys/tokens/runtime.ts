import { audit } from '@/features/security/auditLog'
import { hit } from '@/features/security/rateLimit'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'
import { publicOrigin } from '@/features/google/origin'
import { getEngine } from '@/lib/engine'

import type { ApiKeyContext } from '../service'
import { createD1OneTimeStore } from './oneTime'
import { createD1SigningKeyStore } from './signingKeys'
import { defaultTokenD1 } from './tables'
import type { TokenRuntime } from './http'

/** The real wiring for the token routes: engine auth, D1 stores, audit log, rate limiter. Server only. */
export async function defaultTokenRuntime(): Promise<TokenRuntime> {
  const engine = await getEngine()
  return {
    now: () => Date.now(),
    origin: (request) => publicOrigin(request.url),
    async authenticate(headers) {
      const result = (await engine.auth({ headers, apiKeys: true })) as unknown as {
        user: { id: number | string; email?: string; roles?: unknown } | null
        apiKey?: ApiKeyContext
      }
      if (!result.apiKey || !result.user) throw Object.assign(new Error('not valid'), { status: 401 })
      const roles = Array.isArray(result.user.roles) ? (result.user.roles as string[]) : []
      return { key: result.apiKey, owner: { id: Number(result.user.id), email: String(result.user.email ?? ''), roles } }
    },
    keys: createD1SigningKeyStore(defaultTokenD1),
    oneTime: createD1OneTimeStore(defaultTokenD1),
    limit: (bucket, perMinute) => {
      const decision = hit(bucket, perMinute)
      return { limited: decision.limited, retryAfterSeconds: decision.retryAfterSeconds }
    },
    async audit(entry) {
      const settings = await readSecuritySettingsFromD1()
      await audit({ ...entry, actorId: entry.actorId, collectionSlug: 'api-keys' }, settings)
    },
  }
}
