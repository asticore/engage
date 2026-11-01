import type { CollectionAfterChangeHook } from '@/engine'

import type { ReviewEventAction } from './stateMachine'

/**
 * After every save of a content type that can be reviewed:
 *
 * 1. Shared page cache: when the saved document is live and published, its public URLs are purged,
 *    whichever screen saved it. Before this, only the pages tree commit, the password route and the
 *    approval publish did so, so an edit saved from the document screen could show stale for a TTL.
 *    The purge honours the "clear saved copies on publish" setting (purgeCache does that check).
 * 2. Review history: a save that took content out of review (see contentEditGuard) writes one
 *    `reset` row, so the history shows why the review started again.
 *
 * Never fails the save: each part is best effort. The purge modules load inside the hook: the collection
 * files import this module, so a static import would close a cycle through the schema.
 */

/** Set on the request by the write guard when it reset a review; read here after the write. */
export type ReviewResetNote = { action: ReviewEventAction; note: string }

type HookRequest = {
  engine?: { create: (args: Record<string, unknown>) => Promise<unknown>; find: (args: Record<string, unknown>) => Promise<unknown>; findByID: (args: Record<string, unknown>) => Promise<unknown> }
  reviewReset?: ReviewResetNote
  user?: unknown
}

export const publishAfterChange =
  (collection: string): CollectionAfterChangeHook =>
  async ({ doc, req }) => {
    const record = doc as { id?: unknown; _status?: unknown } | null
    const request = req as unknown as HookRequest | undefined
    if (!record || typeof record.id !== 'number' || !request?.engine) return doc
    const id = record.id
    const user = (req as unknown as { user?: { id?: unknown; name?: unknown } } | undefined)?.user

    if (request.reviewReset) {
      const reset = request.reviewReset
      request.reviewReset = undefined
      try {
        await request.engine.create({
          collection: 'review-events',
          data: {
            collection,
            docId: id,
            docTitle: String((record as { title?: unknown }).title ?? ''),
            action: reset.action,
            note: reset.note,
            ...(typeof user?.id === 'number' ? { actor: user.id, actorName: typeof user.name === 'string' ? user.name : '' } : {}),
          },
          overrideAccess: true,
        })
      } catch (error) {
        console.error('review reset history could not be written', error)
      }
    }

    if (record._status === 'published') {
      try {
        const [{ documentPaths }, { purgeCache }] = await Promise.all([import('@/features/visibility/docPaths'), import('@/features/speed/purge')])
        const paths = await documentPaths(request.engine as never, collection, id)
        if (paths.length > 0) await purgeCache(paths)
      } catch (error) {
        console.error('publish purge failed', error)
      }
    }
    return doc
  }
