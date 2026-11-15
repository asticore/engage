import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { authorizeMedia } from '@/features/media/access'
import { checkFolderMove, droppedPath, parentOf } from '@/features/media/folderTree'
import { MAX_FOLDER_LENGTH, sanitizeFolder } from '@/features/media/folders'
import { readJsonBody } from '@/features/media/store'

/** GET /api/admin-media-folders - how many files sit directly in each folder. */
export async function GET(): Promise<Response> {
  const auth = await authorizeMedia('read')
  if (!auth.context) return auth.response
  const d1 = await rawD1()
  const { results } = await d1.prepare("SELECT COALESCE(folder, '') AS folder, COUNT(*) AS count FROM eg_media GROUP BY COALESCE(folder, '')").all<{ folder: string; count: number }>()
  return NextResponse.json({ rows: results ?? [] })
}

/**
 * POST /api/admin-media-folders
 *   { action: 'rename', from, to }       - `to` is the new full path
 *   { action: 'move', from, parent }     - drop folder `from` inside `parent` ('' = top level)
 *   { action: 'delete', from }           - files go up to the parent folder
 * Files keep their URLs: only the `folder` text changes. Prefix tests use substr, not LIKE, because `_` is a wildcard.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeMedia('update')
  if (!auth.context) return auth.response
  const body = await readJsonBody(request)
  if (!body) return NextResponse.json({ error: 'Send JSON with an action and a folder.' }, { status: 400 })
  const from = sanitizeFolder(body.from)
  if (!from) return NextResponse.json({ error: 'Choose a folder.' }, { status: 400 })

  let to: string
  if (body.action === 'delete') {
    to = parentOf(from)
  } else {
    const wanted = body.action === 'move' ? droppedPath(from, sanitizeFolder(body.parent) ?? '') : body.to
    const check = checkFolderMove(from, wanted)
    if (check.ok === false) return NextResponse.json({ error: check.error }, { status: 400 })
    to = check.to
  }

  const d1 = await rawD1()
  const len = from.length
  const room = MAX_FOLDER_LENGTH
  // Longest resulting path must still fit the folder limit.
  const longest = await d1
    .prepare('SELECT MAX(LENGTH(folder)) AS n FROM eg_media WHERE folder = ?1 OR substr(folder, 1, ?2) = ?3')
    .bind(from, len + 1, `${from}/`)
    .first<{ n: number | null }>()
  if (longest?.n && longest.n - len + to.length > room) {
    return NextResponse.json({ error: `That would make a folder path longer than ${room} characters.` }, { status: 400 })
  }
  const newPrefix = to ? `${to}` : ''
  const res = await d1
    .prepare(
      `UPDATE eg_media SET folder = CASE WHEN folder = ?1 THEN ?3 WHEN ?3 = '' THEN substr(folder, ?2 + 2) ELSE ?3 || substr(folder, ?2 + 1) END
       WHERE folder = ?1 OR substr(folder, 1, ?2 + 1) = ?1 || '/'`,
    )
    .bind(from, len, newPrefix)
    .run()
  return NextResponse.json({ ok: true, changed: res.meta?.changes ?? 0, to })
}
