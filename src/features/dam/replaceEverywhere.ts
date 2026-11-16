import { findMediaPaths, SCAN_LIMIT, USAGE_TARGETS, clearUsageCache } from '@/features/media/usage'

import { replaceAtPaths } from './versions'

type Engine = {
  find: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }>
  findGlobal: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  update: (args: Record<string, unknown>) => Promise<unknown>
  updateGlobal?: (args: Record<string, unknown>) => Promise<unknown>
}

/**
 * Points every place that uses file `from` at file `to` instead (same places the usage scan reports), so `from` can be
 * deleted without breaking pages. Only the changed top-level fields of each document are written. Returns how many
 * documents were changed and the places that could not be read or written.
 */
export async function replaceEverywhere(engine: Engine, from: number, to: number): Promise<{ changed: number; failed: string[] }> {
  let changed = 0
  const failed: string[] = []
  for (const target of USAGE_TARGETS) {
    try {
      if (target.kind === 'global') {
        const doc = await engine.findGlobal({ slug: target.slug, depth: 0, overrideAccess: true })
        const paths = doc ? findMediaPaths(doc, from) : []
        if (doc && paths.length > 0 && engine.updateGlobal) {
          await engine.updateGlobal({ slug: target.slug, data: replaceAtPaths(doc, paths, from, to), overrideAccess: true })
          changed++
        }
        continue
      }
      const found = await engine.find({ collection: target.slug, limit: SCAN_LIMIT, page: 1, depth: 0, overrideAccess: true })
      for (const doc of found.docs) {
        const paths = findMediaPaths(doc, from)
        if (paths.length === 0) continue
        await engine.update({ collection: target.slug, id: doc.id, data: replaceAtPaths(doc, paths, from, to), overrideAccess: true, depth: 0 })
        changed++
      }
    } catch (error) {
      console.error(`Replace everywhere skipped ${target.slug}.`, error)
      failed.push(target.slug)
    }
  }
  clearUsageCache()
  return { changed, failed }
}
