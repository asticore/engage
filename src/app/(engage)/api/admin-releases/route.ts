import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { cleanCollection, cleanDocId, cleanName, cleanWhen, MAX_ITEMS } from '@/features/releases/core'
import { publishRelease, undoRelease } from '@/features/releases/run'
import { addItem, createRelease, deleteRelease, listReleases, relDb, removeItem, updateRelease } from '@/features/releases/store'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Releases (Task 15, 34h6). Admin only.
 *   GET -> { releases: [{ id, name, publishAt, status, note, items: [{ collection, docId, title }] }] }
 *   POST { action: 'create', name, publishAt } | 'update' { id, name, publishAt } | 'add' { id, collection, docId }
 *        | 'remove' { id, collection, docId } | 'publish' { id } | 'undo' { id } | 'delete' { id }
 */
const noStore = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: noStore })

export async function GET(): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const engine = await getEngine()
    const releases = await listReleases(await relDb())
    const withTitles = await Promise.all(releases.map(async (r) => ({
      ...r,
      items: await Promise.all(r.items.map(async (i) => {
        const doc = (await engine.findByID({ collection: i.collection, id: i.docId, depth: 0, overrideAccess: true } as never).catch((): null => null)) as { title?: string; name?: string } | null
        return { ...i, title: doc?.title ?? doc?.name ?? `(missing ${i.docId})` }
      })),
    })))
    return json({ releases: withTitles })
  } catch {
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAdminContext()
    if (!context.user || !context.isAdmin) return json({ error: 'unauthorised' }, 401)
    const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
    const db = await relDb()
    const nowIso = new Date().toISOString()
    const id = cleanDocId(body?.id)
    switch (body?.action) {
      case 'create': {
        const name = cleanName(body.name)
        if (!name) return json({ ok: false, message: 'Give the release a name.' }, 400)
        await createRelease(db, name, cleanWhen(body.publishAt), nowIso)
        return json({ ok: true })
      }
      case 'update':
        if (!id) return json({ ok: false }, 400)
        await updateRelease(db, id, cleanName(body.name) || 'Release', cleanWhen(body.publishAt))
        return json({ ok: true })
      case 'add': {
        const collection = cleanCollection(body.collection)
        const docId = cleanDocId(body.docId)
        if (!id || !collection || !docId) return json({ ok: false, message: 'Pick a type and a numeric id.' }, 400)
        const release = (await listReleases(db)).find((r) => r.id === id)
        if (!release || release.items.length >= MAX_ITEMS) return json({ ok: false, message: 'That release is full or missing.' }, 400)
        const exists = await (await getEngine()).findByID({ collection, id: docId, depth: 0, overrideAccess: true } as never).catch((): null => null)
        if (!exists) return json({ ok: false, message: 'No document with that id.' }, 404)
        await addItem(db, id, collection, docId)
        return json({ ok: true })
      }
      case 'remove': {
        const collection = cleanCollection(body.collection)
        const docId = cleanDocId(body.docId)
        if (!id || !collection || !docId) return json({ ok: false }, 400)
        await removeItem(db, id, collection, docId)
        return json({ ok: true })
      }
      case 'publish':
      case 'undo': {
        const release = id ? (await listReleases(db)).find((r) => r.id === id) : undefined
        if (!release) return json({ ok: false, message: 'Release not found.' }, 404)
        const engine = await getEngine()
        if (body.action === 'publish' && release.status !== 'open') return json({ ok: false, message: 'Only an open release can be published.' }, 400)
        if (body.action === 'undo' && release.status !== 'published') return json({ ok: false, message: 'Only a published release can be undone.' }, 400)
        const result = body.action === 'publish' ? await publishRelease(engine as never, db, release, nowIso) : await undoRelease(engine as never, db, release, nowIso)
        return json({ ok: result.ok, message: result.ok ? undefined : result.failed[0], count: result.published })
      }
      case 'delete':
        if (!id) return json({ ok: false }, 400)
        await deleteRelease(db, id)
        return json({ ok: true })
      default:
        return json({ error: 'unknown action' }, 400)
    }
  } catch {
    return json({ error: 'Internal server error' }, 500)
  }
}
