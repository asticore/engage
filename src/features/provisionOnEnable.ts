/**
 * Site Settings beforeChange hook: when a save switches on a feature whose
 * tables have not been created yet, create them first, so the save either
 * completes with the tables in place or fails with a message and the switch
 * stays off. Then add the feature's starter templates.
 *
 * Everything heavy is imported inside the function: this file is pulled in by the
 * Site Settings global, which is loaded by the engine config, and a static import of
 * the database layer from here would put a cycle in that load order.
 */

import { FEATURES_WITH_TABLES } from './featureTables'

export const provisionFeaturesBeforeChange = async ({ data }: { data?: Record<string, unknown> }): Promise<Record<string, unknown> | undefined> => {
  const requested = (data?.features ?? {}) as Record<string, unknown>
  const wanted = FEATURES_WITH_TABLES.filter((key) => requested[key] === true)
  if (wanted.length === 0) return data

  const { resolveD1Binding } = await import('@/cms/db/connect')
  let db: D1Database
  try {
    db = await resolveD1Binding()
  } catch {
    return data // no D1 here (CLI, unit tests): nothing to provision
  }

  const [{ isFeatureDeferred, provisionFeature }, { consoleLogger }, { seedFeatureStarters }, { getEngine }] = await Promise.all([
    import('@/migrations/provisioning'),
    import('@/localapi/logger'),
    import('./starters'),
    import('@/lib/engine'),
  ])

  for (const key of wanted) {
    if (!(await isFeatureDeferred(db, key))) continue
    const result = await provisionFeature(db, consoleLogger, key)
    if (!result.ok) throw new Error(result.errors.join(' '))
    await seedFeatureStarters(await getEngine(), key)
  }
  return data
}
