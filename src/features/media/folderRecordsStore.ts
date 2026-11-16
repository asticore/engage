/** Database side of media folder records (Task 29a). Every function tolerates a missing table (asset manager never switched on). */
import { blankRecord, listOf, listText, movedPath, withParents, type FolderRecord, type Viewer } from './folderRecords'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results?: T[] }>; run: () => Promise<{ meta?: { changes?: number } }>; first: <T>() => Promise<T | null> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results ?? []

function toRecord(r: Row): FolderRecord {
  return {
    path: str(r.path),
    color: str(r.color) || '#888888',
    description: str(r.description),
    allowedRoles: listOf(r.allowed_roles),
    allowedCompanies: listOf(r.allowed_companies),
    altPrefix: str(r.alt_prefix),
    defaultLicence: str(r.default_licence),
    visibility: r.visibility === 'private' || r.visibility === 'public' ? r.visibility : 'inherit',
  }
}

/** All folder records. An empty list when the table is not there. */
export async function listRecords(d1: D1): Promise<FolderRecord[]> {
  try {
    return (await all(d1, 'SELECT * FROM eg_media_folders ORDER BY path')).map(toRecord)
  } catch {
    return []
  }
}

/**
 * Makes sure every folder that holds a file (and each of its parents) has a record, so folders made before records
 * existed show up with defaults. Cheap: one distinct query and one insert per missing path. Never throws.
 */
export async function backfillFromFiles(d1: D1, nowIso: string): Promise<void> {
  try {
    const used = (await all(d1, "SELECT DISTINCT folder FROM eg_media WHERE folder IS NOT NULL AND folder <> ''")).map((r) => str(r.folder))
    if (used.length === 0) return
    const have = new Set((await all(d1, 'SELECT path FROM eg_media_folders')).map((r) => str(r.path)))
    for (const path of withParents(used)) {
      if (!have.has(path)) await d1.prepare('INSERT OR IGNORE INTO eg_media_folders (path, updated_at, created_at) VALUES (?1, ?2, ?2)').bind(path, nowIso).run()
    }
  } catch {
    // No table yet: nothing to fill.
  }
}

/** Creates a folder record (and its parents) when missing. Returns false when it already existed. */
export async function createFolder(d1: D1, path: string, nowIso: string): Promise<boolean> {
  const existing = await d1.prepare('SELECT id FROM eg_media_folders WHERE path = ?1').bind(path).first<{ id: number }>()
  for (const p of withParents([path])) await d1.prepare('INSERT OR IGNORE INTO eg_media_folders (path, updated_at, created_at) VALUES (?1, ?2, ?2)').bind(p, nowIso).run()
  return !existing
}

export async function saveFields(d1: D1, path: string, f: Omit<FolderRecord, 'path'>, nowIso: string): Promise<void> {
  await d1.prepare('INSERT OR IGNORE INTO eg_media_folders (path, updated_at, created_at) VALUES (?1, ?2, ?2)').bind(path, nowIso).run()
  await d1
    .prepare('UPDATE eg_media_folders SET color=?1, description=?2, allowed_roles=?3, allowed_companies=?4, alt_prefix=?5, default_licence=?6, visibility=?7, updated_at=?8 WHERE path=?9')
    .bind(f.color, f.description, listText(f.allowedRoles), listText(f.allowedCompanies), f.altPrefix, f.defaultLicence, f.visibility, nowIso, path)
    .run()
}

/**
 * A rename or move of folder `from` to `to`, applied to the records ('' deletes: the folder's own record goes and its
 * children move up). When a record already sits at the new path the moved one is dropped, so the paths stay unique.
 */
export async function remapRecords(d1: D1, from: string, to: string, deleting: boolean, nowIso: string): Promise<void> {
  const rows = await all(d1, 'SELECT id, path FROM eg_media_folders WHERE path = ?1 OR substr(path, 1, ?2) = ?3 ORDER BY LENGTH(path)', from, from.length + 1, `${from}/`)
  for (const row of rows) {
    const path = str(row.path)
    if (deleting && path === from) {
      await d1.prepare('DELETE FROM eg_media_folders WHERE id = ?1').bind(row.id).run()
      continue
    }
    const next = movedPath(path, from, to)
    if (!next) continue
    const clash = await d1.prepare('SELECT id FROM eg_media_folders WHERE path = ?1').bind(next).first<{ id: number }>()
    if (clash) await d1.prepare('DELETE FROM eg_media_folders WHERE id = ?1').bind(row.id).run()
    else await d1.prepare('UPDATE eg_media_folders SET path = ?1, updated_at = ?2 WHERE id = ?3').bind(next, nowIso, row.id).run()
  }
  if (!deleting) {
    // The destination's parents must exist as records too.
    for (const p of withParents([to])) await d1.prepare('INSERT OR IGNORE INTO eg_media_folders (path, updated_at, created_at) VALUES (?1, ?2, ?2)').bind(p, nowIso).run()
  }
}

/** The companies (organisations) a user belongs to, as ids. */
export async function companyIdsOf(d1: D1, userId: number | null): Promise<string[]> {
  if (userId === null) return []
  try {
    return (await all(d1, 'SELECT organization_id FROM eg_organization_members WHERE user_id = ?1', userId)).map((r) => str(r.organization_id))
  } catch {
    return []
  }
}

/** Roles an admin can pick: the built-in ones and each custom role's slug. */
export async function listRoles(d1: D1): Promise<Array<{ value: string; label: string }>> {
  const out = [{ value: 'admin', label: 'Admin' }, { value: 'editor', label: 'Editor' }, { value: 'viewer', label: 'Viewer' }]
  try {
    for (const r of await all(d1, 'SELECT name, slug FROM eg_roles ORDER BY name')) if (!out.some((o) => o.value === str(r.slug))) out.push({ value: str(r.slug), label: str(r.name) })
  } catch {
    // Built-in roles only.
  }
  return out
}

/** The list of companies an admin can pick from. */
export async function listCompanies(d1: D1): Promise<Array<{ id: string; name: string }>> {
  try {
    return (await all(d1, 'SELECT id, name FROM eg_organizations ORDER BY name')).map((r) => ({ id: str(r.id), name: str(r.name) }))
  } catch {
    return []
  }
}

export async function viewerFor(d1: D1, user: { id?: unknown; roles?: unknown; customRole?: unknown } | null, isAdmin: boolean): Promise<Viewer> {
  const id = Number(user?.id)
  const roles = Array.isArray(user?.roles) ? (user?.roles as unknown[]).filter((r): r is string => typeof r === 'string') : []
  const custom = user?.customRole
  const customId = typeof custom === 'number' ? custom : custom && typeof custom === 'object' && 'id' in custom ? Number((custom as { id: unknown }).id) : NaN
  if (Number.isFinite(customId)) {
    try {
      const row = await d1.prepare('SELECT slug FROM eg_roles WHERE id = ?1').bind(customId).first<{ slug: string }>()
      if (row?.slug) roles.push(row.slug)
    } catch {
      // No roles table: only the built-in roles count.
    }
  }
  return { isAdmin, roles, companyIds: await companyIdsOf(d1, Number.isFinite(id) ? id : null) }
}

export { blankRecord }

/** Whether a user may use a folder, read from the records. A folder with no records, or no table, is open. */
export async function userMayUse(d1: D1, user: unknown, isAdmin: boolean, path: string): Promise<boolean> {
  if (isAdmin || !path) return true
  const { mayUseFolder } = await import('./folderRecords')
  const recs = await listRecords(d1)
  if (recs.length === 0) return true
  return mayUseFolder(recs, path, await viewerFor(d1, user as never, isAdmin))
}
