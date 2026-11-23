import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { convertLegacyDocuments, scanLegacyBlocks, undoLegacyBatch, type BackupStore } from '@/features/legacyBlocks/service'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Backups are plain JSON objects in the media bucket under their own prefix, never served by the media route. */
async function backupStore(): Promise<BackupStore> {
  const { getMediaBucket } = await import('@/localapi/storage')
  const bucket = await getMediaBucket()
  return {
    put: async (key, text) => {
      await bucket.put(key, text, { httpMetadata: { contentType: 'application/json' } })
    },
    get: async (key) => {
      const object = await bucket.get(key)
      return object ? await object.text() : null
    },
  }
}

/**
 * GET /api/admin-legacy-blocks
 * Read-only report: how many pages, posts, products, templates and reusable sections still hold each legacy block type.
 * Admin only.
 */
export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user) || !context.isAdmin) return json({ error: 'Unauthorised' }, 401)
    return json(await scanLegacyBlocks(context.engine as never))
  } catch (error) {
    console.error('admin-legacy-blocks GET error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

/**
 * POST /api/admin-legacy-blocks  { action: 'convert' | 'undo', execute?, collection?, id?, batchId? }
 * convert: without execute only reports what would change; with it, saves a backup then converts. undo restores a batch.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user) || !context.isAdmin) return json({ error: 'Unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return json({ error: 'Bad request' }, 400)

    const store = await backupStore()
    if (body.action === 'undo') {
      if (typeof body.batchId !== 'string') return json({ error: 'Bad request' }, 400)
      return json(await undoLegacyBatch(context.engine as never, store, body.batchId, context.user))
    }
    if (body.action === 'convert') {
      const id = typeof body.id === 'string' || typeof body.id === 'number' ? body.id : undefined
      const collection = typeof body.collection === 'string' ? body.collection : undefined
      return json(await convertLegacyDocuments(context.engine as never, store, { execute: body.execute === true, collection, id }, context.user))
    }
    return json({ error: 'Bad request' }, 400)
  } catch (error) {
    console.error('admin-legacy-blocks POST error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
