import { consoleLogger } from '@/localapi/logger'

/** Creates the tables of every feature a fresh install leaves out, the way switching each one on would. */
export async function provisionAllFeatures(db: D1Database): Promise<string[]> {
  // Loaded here, not at the top: a spec that imports the whole schema module first must keep that import order.
  const { DEFERRED_ON_FRESH_INSTALL } = await import('@/features/featureTables')
  const { provisionFeature } = await import('@/migrations/provisioning')
  const errors: string[] = []
  for (const key of DEFERRED_ON_FRESH_INSTALL) {
    const result = await provisionFeature(db, consoleLogger, key)
    if (!result.ok) errors.push(`${key}: ${result.errors.join(' ')}`)
  }
  return errors
}
