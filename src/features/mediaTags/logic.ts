/** Media tags: a tree of tags (parent and child) with colours. Pure helpers: validation, tree, filter and CSV. */

export type Tag = { id: number; name: string; parentId: number | null; color: string }
export type TagNode = Tag & { count: number; total: number; children: TagNode[] }
export type TagInput = { name: string; parentId: number | null; color: string }

export const DEFAULT_COLOR = '#888888'
export const MAX_TAG_NAME = 60

export function parseTag(input: Record<string, unknown>, existing: Tag[], selfId: number | null): { ok: true; value: TagInput } | { ok: false; error: string } {
  const name = String(input.name ?? '').replace(/\s+/g, ' ').trim()
  if (!name) return { ok: false, error: 'Give the tag a name.' }
  if (name.length > MAX_TAG_NAME) return { ok: false, error: `Tag names can be up to ${MAX_TAG_NAME} characters.` }
  if (/[>;,"\n]/.test(name)) return { ok: false, error: 'Tag names cannot contain > ; , or quote marks.' }
  const raw = input.parentId === '' || input.parentId === null || input.parentId === undefined ? null : Number(input.parentId)
  if (raw !== null && (!Number.isInteger(raw) || raw <= 0 || !existing.some((t) => t.id === raw))) return { ok: false, error: 'That parent tag does not exist.' }
  if (selfId !== null && raw !== null && (raw === selfId || descendantIds(existing, selfId).includes(raw))) return { ok: false, error: 'A tag cannot go inside itself.' }
  const color = String(input.color ?? '').trim() || DEFAULT_COLOR
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: 'Pick a colour like #3366cc.' }
  const clash = existing.some((t) => t.id !== selfId && t.parentId === raw && t.name.toLowerCase() === name.toLowerCase())
  if (clash) return { ok: false, error: 'There is already a tag with that name here.' }
  return { ok: true, value: { name, parentId: raw, color: color.toLowerCase() } }
}

/** The tag's own id plus every child, grandchild and so on. */
export function descendantIds(tags: Tag[], id: number): number[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) for (const t of tags) if (t.parentId === out[i] && !out.includes(t.id)) out.push(t.id)
  return out
}

/** The tree with each tag's own file count and the count including sub-tags (files with several tags in one branch count once via `distinct`). */
export function buildTagTree(tags: Tag[], links: Array<{ mediaId: number; tagId: number }>): TagNode[] {
  const ids = new Map<number, Set<number>>()
  for (const l of links) (ids.get(l.tagId) ?? ids.set(l.tagId, new Set()).get(l.tagId)!).add(l.mediaId)
  const make = (t: Tag): TagNode => {
    const all = new Set<number>()
    for (const d of descendantIds(tags, t.id)) ids.get(d)?.forEach((m) => all.add(m))
    return { ...t, count: ids.get(t.id)?.size ?? 0, total: all.size, children: tags.filter((c) => c.parentId === t.id).sort(byName).map(make) }
  }
  return tags.filter((t) => t.parentId === null || !tags.some((p) => p.id === t.parentId)).sort(byName).map(make)
}
const byName = (a: Tag, b: Tag): number => a.name.localeCompare(b.name)

/** "Parent > Child" for a tag. */
export function pathOf(tags: Tag[], id: number): string {
  const parts: string[] = []
  let cur = tags.find((t) => t.id === id)
  for (let n = 0; cur && n < 20; n++) {
    parts.unshift(cur.name)
    cur = cur.parentId === null ? undefined : tags.find((t) => t.id === cur!.parentId)
  }
  return parts.join(' > ')
}

const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((x) => x !== '')) rows.push(row)
  return rows
}

/** CSV with one row per file: filename, tags (paths joined by ;), then the tag colours as a second block is not needed: colours go in tags.csv. */
export function exportFilesCsv(tags: Tag[], files: Array<{ filename: string; tagIds: number[] }>): string {
  const lines = ['filename,tags']
  for (const f of files) lines.push(`${cell(f.filename)},${cell(f.tagIds.map((id) => pathOf(tags, id)).filter(Boolean).sort().join(';'))}`)
  return lines.join('\n')
}
export function exportTagsCsv(tags: Tag[]): string {
  const lines = ['tag,color']
  for (const t of [...tags].sort((a, b) => pathOf(tags, a.id).localeCompare(pathOf(tags, b.id)))) lines.push(`${cell(pathOf(tags, t.id))},${t.color}`)
  return lines.join('\n')
}

/** Reads the tags CSV (`tag,color`) into paths in parent-first order. */
export function parseTagsCsv(text: string): Array<{ path: string[]; color: string }> {
  const rows = parseCsv(text)
  if (rows[0]?.[0]?.trim().toLowerCase() === 'tag') rows.shift()
  const seen = new Set<string>()
  const out: Array<{ path: string[]; color: string }> = []
  for (const r of rows) {
    const path = String(r[0] ?? '').split('>').map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (path.length === 0 || path.some((p) => p.length > MAX_TAG_NAME)) continue
    const color = /^#[0-9a-fA-F]{6}$/.test(String(r[1] ?? '').trim()) ? String(r[1]).trim().toLowerCase() : DEFAULT_COLOR
    for (let i = 1; i <= path.length; i++) {
      const key = path.slice(0, i).join('>').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ path: path.slice(0, i), color: i === path.length ? color : DEFAULT_COLOR })
    }
  }
  return out.sort((a, b) => a.path.length - b.path.length)
}

/** Reads the files CSV (`filename,tags`). */
export function parseFilesCsv(text: string): Array<{ filename: string; paths: string[][] }> {
  const rows = parseCsv(text)
  if (rows[0]?.[0]?.trim().toLowerCase() === 'filename') rows.shift()
  return rows
    .map((r) => ({ filename: String(r[0] ?? '').trim(), paths: String(r[1] ?? '').split(';').map((p) => p.split('>').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)).filter((p) => p.length > 0) }))
    .filter((r) => r.filename)
}
