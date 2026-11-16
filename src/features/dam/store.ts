import { APPLIES_TO, FIELD_TYPES, type MetaField, type MetaFieldInput } from './metaFields'
import { EMPTY_RIGHTS, STATUSES, type AssetStatus, type Rights } from './rights'
import type { FolderRule } from './access'
import type { Share, ShareKind } from './share'
import { buildSearch, parseFilters, type SearchContext, type SearchFilters } from './search'
import type { Version } from './versions'

type Stmt = { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<{ meta?: { last_row_id?: number; changes?: number } }> } }
export type D1 = { prepare: (sql: string) => Stmt }
type Row = Record<string, unknown>

const all = async (d1: D1, sql: string, ...args: unknown[]): Promise<Row[]> => (await d1.prepare(sql).bind(...args).all<Row>()).results
const run = (d1: D1, sql: string, ...args: unknown[]) => d1.prepare(sql).bind(...args).run()
const chunks = <T,>(list: T[], n: number): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))
const marks = (n: number): string => Array.from({ length: n }, (_, i) => `?${i + 1}`).join(',')
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const nullable = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export type Settings = {
  stripGps: boolean
  autoExtract: boolean
  keepVersions: number
  blockUsedDelete: boolean
  duplicateAction: 'warn' | 'block' | 'allow'
  expiryWarnDays: number
  requireApproval: boolean
  quotaMb: number
}
export const DEFAULT_SETTINGS: Settings = { stripGps: true, autoExtract: true, keepVersions: 5, blockUsedDelete: true, duplicateAction: 'warn', expiryWarnDays: 30, requireApproval: false, quotaMb: 0 }

export async function getSettings(d1: D1): Promise<Settings> {
  const r = (await all(d1, 'SELECT * FROM eg_media_dam_settings WHERE id = 1'))[0]
  if (!r) return DEFAULT_SETTINGS
  const action = str(r.duplicate_action)
  return {
    stripGps: Number(r.strip_gps) !== 0,
    autoExtract: Number(r.auto_extract) !== 0,
    keepVersions: Number(r.keep_versions),
    blockUsedDelete: Number(r.block_used_delete) !== 0,
    duplicateAction: action === 'block' || action === 'allow' ? action : 'warn',
    expiryWarnDays: Number(r.expiry_warn_days),
    requireApproval: Number(r.require_approval) !== 0,
    quotaMb: Number(r.quota_mb),
  }
}

export function parseSettings(input: Record<string, unknown>): { ok: true; value: Settings } | { ok: false; error: string } {
  const int = (v: unknown, min: number, max: number): number | null => (Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : null)
  const keepVersions = int(input.keepVersions, 0, 50)
  const expiryWarnDays = int(input.expiryWarnDays, 0, 365)
  const quotaMb = int(input.quotaMb, 0, 10_000_000)
  if (keepVersions === null) return { ok: false, error: 'Versions kept must be between 0 and 50.' }
  if (expiryWarnDays === null) return { ok: false, error: 'Expiry warning days must be between 0 and 365.' }
  if (quotaMb === null) return { ok: false, error: 'The storage limit must be a whole number of megabytes (0 for none).' }
  const action = String(input.duplicateAction ?? 'warn')
  if (action !== 'warn' && action !== 'block' && action !== 'allow') return { ok: false, error: 'Choose what happens with duplicates.' }
  return { ok: true, value: { stripGps: input.stripGps !== false, autoExtract: input.autoExtract !== false, keepVersions, blockUsedDelete: input.blockUsedDelete !== false, duplicateAction: action, expiryWarnDays, requireApproval: input.requireApproval === true, quotaMb } }
}

export async function saveSettings(d1: D1, s: Settings): Promise<void> {
  await run(
    d1,
    `INSERT INTO eg_media_dam_settings (id, strip_gps, auto_extract, keep_versions, block_used_delete, duplicate_action, expiry_warn_days, require_approval, quota_mb)
     VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT(id) DO UPDATE SET strip_gps=?1, auto_extract=?2, keep_versions=?3, block_used_delete=?4, duplicate_action=?5, expiry_warn_days=?6, require_approval=?7, quota_mb=?8`,
    s.stripGps ? 1 : 0, s.autoExtract ? 1 : 0, s.keepVersions, s.blockUsedDelete ? 1 : 0, s.duplicateAction, s.expiryWarnDays, s.requireApproval ? 1 : 0, s.quotaMb,
  )
}

export type Asset = { mediaId: number; rights: Rights; contentHash: string; exif: Record<string, unknown>; meta: Record<string, string>; searchText: string; visibility: 'public' | 'private' }

const json = (text: string): Record<string, never> => {
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

function toAsset(r: Row): Asset {
  const status = str(r.status)
  return {
    mediaId: Number(r.media_id),
    rights: {
      status: (STATUSES as readonly string[]).includes(status) ? (status as AssetStatus) : 'approved',
      licenceType: str(r.licence_type), licenceTerms: str(r.licence_terms), credit: str(r.credit), usageNotes: str(r.usage_notes), territory: str(r.territory), releaseNote: str(r.release_note),
      licenceStart: nullable(r.licence_start), licenceExpiry: nullable(r.licence_expiry), embargoUntil: nullable(r.embargo_until),
    },
    contentHash: str(r.content_hash),
    exif: json(str(r.exif_json)),
    meta: json(str(r.meta_json)),
    searchText: str(r.search_text),
    visibility: r.visibility === 'private' ? 'private' : 'public',
  }
}

/** Assets for a set of files. A file with no row is the default asset (approved, no rights, public). */
export async function getAssets(d1: D1, mediaIds: number[]): Promise<Map<number, Asset>> {
  const out = new Map<number, Asset>()
  for (const part of chunks(mediaIds, 50)) {
    for (const r of await all(d1, `SELECT * FROM eg_media_assets WHERE media_id IN (${marks(part.length)})`, ...part)) out.set(Number(r.media_id), toAsset(r))
  }
  return out
}
export const defaultAsset = (mediaId: number): Asset => ({ mediaId, rights: { ...EMPTY_RIGHTS }, contentHash: '', exif: {}, meta: {}, searchText: '', visibility: 'public' })

async function ensureRow(d1: D1, mediaId: number, nowIso: string): Promise<void> {
  await run(d1, 'INSERT OR IGNORE INTO eg_media_assets (media_id, created_at, updated_at) VALUES (?1, ?2, ?2)', mediaId, nowIso)
}

export async function saveRights(d1: D1, mediaId: number, r: Rights, nowIso: string): Promise<void> {
  await ensureRow(d1, mediaId, nowIso)
  await run(
    d1,
    'UPDATE eg_media_assets SET status=?1, licence_type=?2, licence_terms=?3, credit=?4, usage_notes=?5, territory=?6, release_note=?7, licence_start=?8, licence_expiry=?9, embargo_until=?10, updated_at=?11 WHERE media_id=?12',
    r.status, r.licenceType, r.licenceTerms, r.credit, r.usageNotes, r.territory, r.releaseNote, r.licenceStart, r.licenceExpiry, r.embargoUntil, nowIso, mediaId,
  )
}
export async function saveMeta(d1: D1, mediaId: number, meta: Record<string, string>, searchText: string, nowIso: string): Promise<void> {
  await ensureRow(d1, mediaId, nowIso)
  await run(d1, 'UPDATE eg_media_assets SET meta_json=?1, search_text=?2, updated_at=?3 WHERE media_id=?4', JSON.stringify(meta), searchText, nowIso, mediaId)
}
export async function saveExif(d1: D1, mediaId: number, exif: Record<string, unknown>, searchText: string, nowIso: string): Promise<void> {
  await ensureRow(d1, mediaId, nowIso)
  await run(d1, 'UPDATE eg_media_assets SET exif_json=?1, search_text=?2, updated_at=?3 WHERE media_id=?4', JSON.stringify(exif), searchText, nowIso, mediaId)
}
/** Sets the status of many files at once (bulk approve, archive and so on). */
export async function setStatus(d1: D1, mediaIds: number[], status: AssetStatus, nowIso: string): Promise<void> {
  for (const id of mediaIds) {
    await ensureRow(d1, id, nowIso)
    await run(d1, 'UPDATE eg_media_assets SET status=?1, updated_at=?2 WHERE media_id=?3', status, nowIso, id)
  }
}

/** Ids of files that cannot be used right now, so lists and pickers can leave them out. */
export async function unusableIds(d1: D1, todayIso: string, requireApproval: boolean): Promise<number[]> {
  const rows = await all(
    d1,
    `SELECT media_id FROM eg_media_assets WHERE status = 'archived' OR (licence_expiry IS NOT NULL AND licence_expiry < ?1) OR (embargo_until IS NOT NULL AND embargo_until > ?1) OR (licence_start IS NOT NULL AND licence_start > ?1) OR (?2 = 1 AND status <> 'approved')`,
    todayIso, requireApproval ? 1 : 0,
  )
  return rows.map((r) => Number(r.media_id))
}

/** Files whose licence runs out within `days`, soonest first. */
export async function expiringSoon(d1: D1, todayIso: string, untilIso: string): Promise<Array<{ mediaId: number; licenceExpiry: string }>> {
  return (await all(d1, `SELECT media_id, licence_expiry FROM eg_media_assets WHERE licence_expiry IS NOT NULL AND licence_expiry >= ?1 AND licence_expiry <= ?2 ORDER BY licence_expiry LIMIT 200`, todayIso, untilIso)).map((r) => ({ mediaId: Number(r.media_id), licenceExpiry: str(r.licence_expiry) }))
}
export async function expiredIds(d1: D1, todayIso: string): Promise<Array<{ mediaId: number; licenceExpiry: string }>> {
  return (await all(d1, `SELECT media_id, licence_expiry FROM eg_media_assets WHERE licence_expiry IS NOT NULL AND licence_expiry < ?1 ORDER BY licence_expiry LIMIT 200`, todayIso)).map((r) => ({ mediaId: Number(r.media_id), licenceExpiry: str(r.licence_expiry) }))
}

// Collections

/** `count` is -1 for a smart collection, whose files come from a saved search. */
export type Collection = { id: number; name: string; description: string; count: number; smart: boolean }

export async function listCollections(d1: D1): Promise<Collection[]> {
  return (await all(d1, 'SELECT c.id AS id, c.name AS name, c.description AS description, (SELECT COUNT(*) FROM eg_media_collection_items i WHERE i.collection_id = c.id) AS n, c.smart_query AS smart_query FROM eg_media_collections c ORDER BY c.name')).map((r) => ({ id: Number(r.id), name: str(r.name), description: str(r.description), count: str(r.smart_query) ? -1 : Number(r.n), smart: Boolean(str(r.smart_query)) }))
}
export function parseCollection(input: Record<string, unknown>, existing: Collection[], selfId: number | null): { ok: true; value: { name: string; description: string } } | { ok: false; error: string } {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'Give the collection a name.' }
  if (name.length > 80) return { ok: false, error: 'Collection names can be up to 80 characters.' }
  const description = String(input.description ?? '').trim()
  if (description.length > 500) return { ok: false, error: 'The description can be up to 500 characters.' }
  if (existing.some((c) => c.id !== selfId && c.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'There is already a collection with that name.' }
  return { ok: true, value: { name, description } }
}
export async function saveCollection(d1: D1, id: number | null, v: { name: string; description: string }, nowIso: string): Promise<number> {
  if (id) {
    await run(d1, 'UPDATE eg_media_collections SET name=?1, description=?2, updated_at=?3 WHERE id=?4', v.name, v.description, nowIso, id)
    return id
  }
  const res = await run(d1, 'INSERT INTO eg_media_collections (name, description, updated_at, created_at) VALUES (?1,?2,?3,?3)', v.name, v.description, nowIso)
  return Number(res.meta?.last_row_id ?? 0)
}
export async function deleteCollection(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_media_collection_items WHERE collection_id = ?1', id)
  await run(d1, 'DELETE FROM eg_media_collections WHERE id = ?1', id)
}
export async function assignCollection(d1: D1, collectionId: number, mediaIds: number[], remove: boolean): Promise<void> {
  for (const m of mediaIds) {
    if (remove) await run(d1, 'DELETE FROM eg_media_collection_items WHERE collection_id = ?1 AND media_id = ?2', collectionId, m)
    else await run(d1, 'INSERT OR IGNORE INTO eg_media_collection_items (collection_id, media_id) VALUES (?1, ?2)', collectionId, m)
  }
}
export async function mediaIdsInCollection(d1: D1, collectionId: number): Promise<number[]> {
  return (await all(d1, 'SELECT media_id FROM eg_media_collection_items WHERE collection_id = ?1', collectionId)).map((r) => Number(r.media_id))
}
export async function collectionsForMedia(d1: D1, mediaId: number): Promise<number[]> {
  return (await all(d1, 'SELECT collection_id FROM eg_media_collection_items WHERE media_id = ?1', mediaId)).map((r) => Number(r.collection_id))
}

// Metadata fields

export async function listFields(d1: D1): Promise<MetaField[]> {
  return (await all(d1, 'SELECT * FROM eg_media_meta_fields ORDER BY sort_order, label')).map((r) => ({
    id: Number(r.id), label: str(r.label), key: str(r.field_key),
    type: (FIELD_TYPES as readonly string[]).includes(str(r.type)) ? (str(r.type) as MetaField['type']) : 'text',
    options: str(r.options) ? str(r.options).split('\n').filter(Boolean) : [],
    required: Number(r.required) !== 0, searchable: Number(r.searchable) !== 0,
    appliesTo: (APPLIES_TO as readonly string[]).includes(str(r.applies_to)) ? (str(r.applies_to) as MetaField['appliesTo']) : 'all',
    sortOrder: Number(r.sort_order),
  }))
}
export async function saveField(d1: D1, id: number | null, v: MetaFieldInput, nowIso: string): Promise<number> {
  const options = v.options.join('\n')
  if (id) {
    await run(d1, 'UPDATE eg_media_meta_fields SET label=?1, field_key=?2, type=?3, options=?4, required=?5, searchable=?6, applies_to=?7, sort_order=?8, updated_at=?9 WHERE id=?10', v.label, v.key, v.type, options, v.required ? 1 : 0, v.searchable ? 1 : 0, v.appliesTo, v.sortOrder, nowIso, id)
    return id
  }
  const res = await run(d1, 'INSERT INTO eg_media_meta_fields (label, field_key, type, options, required, searchable, applies_to, sort_order, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)', v.label, v.key, v.type, options, v.required ? 1 : 0, v.searchable ? 1 : 0, v.appliesTo, v.sortOrder, nowIso)
  return Number(res.meta?.last_row_id ?? 0)
}
/** Deleting a field leaves old values in files' stored data; they stop showing and are never searched again once rebuilt. */
export async function deleteField(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_media_meta_fields WHERE id = ?1', id)
}

export async function logActivity(d1: D1, mediaId: number, action: string, detail: string, userId: number | null, nowIso: string): Promise<void> {
  await run(d1, 'INSERT INTO eg_media_activity (media_id, action, detail, user_id, created_at) VALUES (?1,?2,?3,?4,?5)', mediaId, action, detail.slice(0, 500), userId, nowIso)
}
export async function listActivity(d1: D1, mediaId: number, limit = 50): Promise<Array<{ action: string; detail: string; userId: number | null; createdAt: string }>> {
  return (await all(d1, 'SELECT action, detail, user_id, created_at FROM eg_media_activity WHERE media_id = ?1 ORDER BY id DESC LIMIT ?2', mediaId, limit)).map((r) => ({ action: str(r.action), detail: str(r.detail), userId: r.user_id === null ? null : Number(r.user_id), createdAt: str(r.created_at) }))
}

// Versions

const toVersion = (r: Row): Version => ({
  id: Number(r.id), mediaId: Number(r.media_id), r2Key: str(r.r2_key), filename: str(r.filename), mimeType: str(r.mime_type), filesize: Number(r.filesize),
  width: r.width === null ? null : Number(r.width), height: r.height === null ? null : Number(r.height), contentHash: str(r.content_hash), note: str(r.note), createdAt: str(r.created_at),
})
export async function listVersions(d1: D1, mediaId: number): Promise<Version[]> {
  return (await all(d1, 'SELECT * FROM eg_media_versions WHERE media_id = ?1 ORDER BY created_at DESC, id DESC', mediaId)).map(toVersion)
}
export async function getVersion(d1: D1, mediaId: number, versionId: number): Promise<Version | null> {
  const r = (await all(d1, 'SELECT * FROM eg_media_versions WHERE media_id = ?1 AND id = ?2', mediaId, versionId))[0]
  return r ? toVersion(r) : null
}
export async function addVersion(d1: D1, v: Omit<Version, 'id'> & { userId: number | null }): Promise<number> {
  const res = await run(d1, 'INSERT INTO eg_media_versions (media_id, r2_key, filename, mime_type, filesize, width, height, content_hash, note, user_id, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)', v.mediaId, v.r2Key, v.filename, v.mimeType, v.filesize, v.width, v.height, v.contentHash, v.note, v.userId, v.createdAt)
  return Number(res.meta?.last_row_id ?? 0)
}
export async function deleteVersionRow(d1: D1, versionId: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_media_versions WHERE id = ?1', versionId)
}

/** Removes everything the asset manager keeps about a deleted file and returns the stored version keys to delete from storage. */
export async function purgeAsset(d1: D1, mediaId: number): Promise<string[]> {
  const keys = (await listVersions(d1, mediaId)).map((v) => v.r2Key)
  await run(d1, 'DELETE FROM eg_media_versions WHERE media_id = ?1', mediaId)
  await run(d1, 'DELETE FROM eg_media_assets WHERE media_id = ?1', mediaId)
  await run(d1, 'DELETE FROM eg_media_collection_items WHERE media_id = ?1', mediaId)
  return keys
}

// Search, saved searches and smart collections

/** Replaces the searchable text of a file (details, caption, camera data and words read from a document). */
export async function setSearchText(d1: D1, mediaId: number, text: string, nowIso: string): Promise<void> {
  await ensureRow(d1, mediaId, nowIso)
  await run(d1, 'UPDATE eg_media_assets SET search_text=?1, updated_at=?2 WHERE media_id=?3', text, nowIso, mediaId)
}

export type SearchHit = { id: number; filename: string | null; url: string | null; alt: string | null; mimeType: string | null; filesize: number | null; width: number | null; height: number | null; folder: string | null; status: string; licenceExpiry: string | null }

export async function runSearch(d1: D1, f: SearchFilters, ctx: SearchContext, page: number, pageSize: number): Promise<{ docs: SearchHit[]; total: number }> {
  const q = buildSearch(f, ctx, page, pageSize)
  const rows = await all(d1, q.sql, ...q.args)
  const total = Number((await all(d1, q.countSql, ...q.args))[0]?.n ?? 0)
  const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
  return {
    total,
    docs: rows.map((r) => ({ id: Number(r.id), filename: nullable(r.filename), url: nullable(r.url), alt: nullable(r.alt), mimeType: nullable(r.mime_type), filesize: num(r.filesize), width: num(r.width), height: num(r.height), folder: nullable(r.folder), status: str(r.status) || 'approved', licenceExpiry: nullable(r.licence_expiry) })),
  }
}

/** A tag and all its sub-tags. Empty when the tags feature has no tables yet (it is off). */
export async function tagWithChildren(d1: D1, tagId: number): Promise<number[]> {
  try {
    return (await all(d1, 'WITH RECURSIVE t(id) AS (SELECT ?1 UNION SELECT c.id FROM eg_media_tags c JOIN t ON c.parent_id = t.id) SELECT id FROM t', tagId)).map((r) => Number(r.id))
  } catch {
    return []
  }
}

/** Every file a smart collection holds right now (up to 5000). */
export async function smartCollectionIds(d1: D1, collectionId: number, ctx: SearchContext): Promise<number[]> {
  const row = (await all(d1, 'SELECT smart_query FROM eg_media_collections WHERE id = ?1', collectionId))[0]
  const filters = parseFilters(json(str(row?.smart_query)))
  if (filters.tagId && !ctx.tagIds) ctx = { ...ctx, tagIds: await tagWithChildren(d1, filters.tagId) }
  const ids: number[] = []
  for (let page = 1; page <= 25; page++) {
    const { docs, total } = await runSearch(d1, { ...filters, collectionId: 0 }, ctx, page, 200)
    ids.push(...docs.map((d) => d.id))
    if (ids.length >= total || docs.length === 0) break
  }
  return ids
}

export type SavedSearch = { id: number; name: string; filters: SearchFilters }

export async function listSavedSearches(d1: D1): Promise<SavedSearch[]> {
  return (await all(d1, 'SELECT id, name, query_json FROM eg_media_saved_searches ORDER BY name')).map((r) => ({ id: Number(r.id), name: str(r.name), filters: parseFilters(json(str(r.query_json))) }))
}
export function parseSearchName(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'Give it a name.' }
  if (name.length > 80) return { ok: false, error: 'Names can be up to 80 characters.' }
  return { ok: true, value: name }
}
export async function saveSearch(d1: D1, name: string, filters: SearchFilters, userId: number | null, nowIso: string): Promise<number> {
  const res = await run(d1, 'INSERT INTO eg_media_saved_searches (name, query_json, user_id, updated_at, created_at) VALUES (?1,?2,?3,?4,?4)', name, JSON.stringify(filters), userId, nowIso)
  return Number(res.meta?.last_row_id ?? 0)
}
export async function deleteSearch(d1: D1, id: number): Promise<void> {
  await run(d1, 'DELETE FROM eg_media_saved_searches WHERE id = ?1', id)
}
export async function saveSmartCollection(d1: D1, name: string, filters: SearchFilters, nowIso: string): Promise<number> {
  const res = await run(d1, "INSERT INTO eg_media_collections (name, description, smart_query, updated_at, created_at) VALUES (?1,'',?2,?3,?3)", name, JSON.stringify({ ...filters, collectionId: 0 }), nowIso)
  return Number(res.meta?.last_row_id ?? 0)
}

// Private files, folder rules and share links

export async function setVisibility(d1: D1, mediaIds: number[], visibility: 'public' | 'private', nowIso: string): Promise<void> {
  for (const id of mediaIds) {
    await ensureRow(d1, id, nowIso)
    await run(d1, 'UPDATE eg_media_assets SET visibility=?1, updated_at=?2 WHERE media_id=?3', visibility, nowIso, id)
  }
}

export async function listFolderRules(d1: D1): Promise<FolderRule[]> {
  return (await all(d1, "SELECT path, visibility FROM eg_media_folders WHERE visibility <> 'inherit' ORDER BY path")).map((r) => ({ path: str(r.path), visibility: r.visibility === 'private' ? 'private' : 'public' }))
}
export async function saveFolderRule(d1: D1, path: string, visibility: 'inherit' | 'public' | 'private', nowIso: string): Promise<void> {
  await run(d1, "INSERT INTO eg_media_folders (path, visibility, updated_at, created_at) VALUES (?1, ?2, ?3, ?3) ON CONFLICT(path) DO UPDATE SET visibility=?2, updated_at=?3", path, visibility, nowIso)
}

const toShare = (r: Row): Share => ({
  id: Number(r.id), kind: r.kind === 'collection' ? 'collection' : 'file', targetId: Number(r.target_id), expiresAt: nullable(r.expires_at), hasPassword: Boolean(str(r.password_hash)),
  maxDownloads: Number(r.max_downloads), downloads: Number(r.downloads), revoked: Number(r.revoked) !== 0, createdAt: str(r.created_at),
})

export async function createShare(d1: D1, v: { tokenHash: string; kind: ShareKind; targetId: number; expiresAt: string | null; passwordHash: string; maxDownloads: number; userId: number | null }, nowIso: string): Promise<number> {
  const res = await run(d1, 'INSERT INTO eg_media_shares (token_hash, kind, target_id, expires_at, password_hash, max_downloads, user_id, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)', v.tokenHash, v.kind, v.targetId, v.expiresAt, v.passwordHash, v.maxDownloads, v.userId, nowIso)
  return Number(res.meta?.last_row_id ?? 0)
}
export async function listShares(d1: D1, kind: ShareKind, targetId: number): Promise<Share[]> {
  return (await all(d1, 'SELECT * FROM eg_media_shares WHERE kind = ?1 AND target_id = ?2 ORDER BY id DESC LIMIT 50', kind, targetId)).map(toShare)
}
export async function revokeShare(d1: D1, id: number): Promise<void> {
  await run(d1, 'UPDATE eg_media_shares SET revoked = 1 WHERE id = ?1', id)
}
export async function getShareByHash(d1: D1, tokenHash: string): Promise<(Share & { passwordHash: string }) | null> {
  const r = (await all(d1, 'SELECT * FROM eg_media_shares WHERE token_hash = ?1', tokenHash))[0]
  return r ? { ...toShare(r), passwordHash: str(r.password_hash) } : null
}
/** Counts one download, but only while the link is under its limit, so two quick downloads cannot both take the last one. */
export async function takeDownload(d1: D1, id: number): Promise<boolean> {
  const res = await run(d1, 'UPDATE eg_media_shares SET downloads = downloads + 1 WHERE id = ?1 AND revoked = 0 AND (max_downloads = 0 OR downloads < max_downloads)', id)
  return Number(res.meta?.changes ?? 0) > 0
}

export type MediaRow = { id: number; filename: string; mimeType: string; filesize: number; alt: string }
export async function mediaRows(d1: D1, ids: number[]): Promise<MediaRow[]> {
  const out: MediaRow[] = []
  for (const part of chunks(ids, 50)) {
    for (const r of await all(d1, `SELECT id, filename, mime_type, filesize, alt FROM eg_media WHERE id IN (${marks(part.length)}) AND filename IS NOT NULL`, ...part)) out.push({ id: Number(r.id), filename: str(r.filename), mimeType: str(r.mime_type), filesize: Number(r.filesize ?? 0), alt: str(r.alt) })
  }
  return out
}
