import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { authorizeMedia } from '@/features/media/access'
import { checkFolderMove, droppedPath, parentOf } from '@/features/media/folderTree'
import { forgetPrivateCache } from '@/features/dam/access'
import { mayUseFolder, newFolderPath, parseFolderFields } from '@/features/media/folderRecords'
import * as records from '@/features/media/folderRecordsStore'
import { MAX_FOLDER_LENGTH, sanitizeFolder } from '@/features/media/folders'
import { adminRequestRefusal } from '@/features/forms/origin'
import { readJsonBody } from '@/features/media/store'

const NO_ACCESS = 'You do not have access to that folder.'

/**
 * GET /api/admin-media-folders - how many files sit directly in each folder (empty folders count 0), plus the folder
 * records, the roles and the companies a folder can be limited to. Folders the viewer may not use are left out.
 */
export async function GET(): Promise<Response> {
  const auth = await authorizeMedia('read')
  if (!auth.context) return auth.response
  const d1 = await rawD1()
  const now = new Date().toISOString()
  await records.backfillFromFiles(d1 as never as records.D1, now)
  const recs = await records.listRecords(d1 as never as records.D1)
  const viewer = await records.viewerFor(d1 as never as records.D1, auth.context.user as never, auth.context.isAdmin)
  const { results } = await d1.prepare("SELECT COALESCE(folder, '') AS folder, COUNT(*) AS count FROM eg_media GROUP BY COALESCE(folder, '')").all<{ folder: string; count: number }>()
  const rows = (results ?? []).filter((r) => mayUseFolder(recs, r.folder, viewer))
  const have = new Set(rows.map((r) => r.folder))
  for (const r of recs) if (!have.has(r.path) && mayUseFolder(recs, r.path, viewer)) rows.push({ folder: r.path, count: 0 })
  const visible = recs.filter((r) => mayUseFolder(recs, r.path, viewer))
  const admin = auth.context.isAdmin
  return NextResponse.json({
    rows,
    folders: visible,
    roles: admin ? await records.listRoles(d1 as never as records.D1) : [],
    companies: admin ? await records.listCompanies(d1 as never as records.D1) : [],
    isAdmin: admin,
  })
}

/**
 * POST /api/admin-media-folders
 *   { action: 'rename', from, to }       - `to` is the new full path
 *   { action: 'move', from, parent }     - drop folder `from` inside `parent` ('' = top level)
 *   { action: 'delete', from }           - files go up to the parent folder
 *   { action: 'create', parent, name }   - an empty folder
 *   { action: 'update', path, ...fields } - colour, description, who may use it (admins only), alt start, licence, visibility
 * Files keep their URLs: only the `folder` text changes. Prefix tests use substr, not LIKE, because `_` is a wildcard.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
  const auth = await authorizeMedia('update')
  if (!auth.context) return auth.response
  const body = await readJsonBody(request)
  if (!body) return NextResponse.json({ error: 'Send JSON with an action and a folder.' }, { status: 400 })
  const d1 = await rawD1()
  const rd1 = d1 as never as records.D1
  const now = new Date().toISOString()
  const recs = await records.listRecords(rd1)
  const viewer = await records.viewerFor(rd1, auth.context.user as never, auth.context.isAdmin)

  if (body.action === 'create') {
    const parent = sanitizeFolder(body.parent) ?? ''
    const made = newFolderPath(parent, String(body.name ?? ''))
    if (made.ok === false) return NextResponse.json({ error: made.error }, { status: 400 })
    if (!mayUseFolder(recs, parent, viewer)) return NextResponse.json({ error: NO_ACCESS }, { status: 403 })
    const created = await records.createFolder(rd1, made.path, now)
    return NextResponse.json({ ok: true, path: made.path, created })
  }
  if (body.action === 'update') {
    const path = sanitizeFolder(body.path)
    if (!path) return NextResponse.json({ error: 'Choose a folder.' }, { status: 400 })
    if (!mayUseFolder(recs, path, viewer)) return NextResponse.json({ error: NO_ACCESS }, { status: 403 })
    const parsed = parseFolderFields(body)
    if (parsed.ok === false) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const current = recs.find((r) => r.path === path)
    let value = parsed.value
    // Only an admin changes who may use a folder or whether it is private: others keep what is there.
    if (!auth.context.isAdmin) {
      value = { ...value, allowedRoles: current?.allowedRoles ?? [], allowedCompanies: current?.allowedCompanies ?? [], visibility: current?.visibility ?? 'inherit' }
    }
    await records.saveFields(rd1, path, value, now)
    forgetPrivateCache()
    return NextResponse.json({ ok: true })
  }

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

  if (!mayUseFolder(recs, from, viewer) || !mayUseFolder(recs, to, viewer)) return NextResponse.json({ error: NO_ACCESS }, { status: 403 })
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
  await records.remapRecords(rd1, from, to, body.action === 'delete', now)
  forgetPrivateCache()
  return NextResponse.json({ ok: true, changed: res.meta?.changes ?? 0, to })
}
