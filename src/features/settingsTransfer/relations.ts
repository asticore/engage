import type { Engine } from '@/engine'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Products } from '@/features/ecommerce/collections/Products'

import { DOC_NOISE_KEYS, isPlainObject, withoutKeys, type ExportFile, type ImportSection, type JsonObject } from './format'

/**
 * Relationship and upload fields of the exported content. A relation is written
 * to the file as the name of the record it points at (slug, file name or email),
 * never as an id, and an import looks that name up on the site it lands on.
 */

/** Meta relations that are never exported (who made the record). */
export const LINK_META_KEYS = ['createdBy', 'updatedBy'] as const

/** The field of a target record that names it in the file. Most collections use slug. */
const KEY_FIELD: Record<string, string> = {
  media: 'filename',
  users: 'email',
  'page-templates': 'name',
  'field-groups': 'name',
}

export const keyFieldFor = (collection: string): string => KEY_FIELD[collection] ?? 'slug'

/** The file list that holds the records of a target collection, when the file has them. */
const FILE_RECORDS: Partial<Record<string, { section: ImportSection; records: (file: ExportFile) => JsonObject[] }>> = {
  pages: { section: 'pages', records: (file) => file.content.pages },
  posts: { section: 'posts', records: (file) => file.content.posts },
  products: { section: 'products', records: (file) => file.content.products },
  media: { section: 'mediaMetadata', records: (file) => file.content.mediaMetadata },
  users: { section: 'users', records: (file) => file.users },
  'page-templates': { section: 'pageTemplates', records: (file) => file.pageTemplates },
  'field-groups': { section: 'fieldGroups', records: (file) => file.fieldGroups },
}

/* -------------------------------------------------------------------------- */
/* Finding the relation fields of a collection                                */
/* -------------------------------------------------------------------------- */

export type RelationSpec = {
  /** Path to the field. `*` steps into each item of an array field. */
  path: string[]
  /** Field name, for messages. */
  field: string
  /** Collection the field points at. */
  target: string
  hasMany: boolean
}

type FieldLike = {
  type?: string
  name?: string
  fields?: FieldLike[]
  tabs?: Array<{ name?: string; fields: FieldLike[] }>
  relationTo?: unknown
  hasMany?: boolean
}

function walkFields(fields: FieldLike[], prefix: string[], out: RelationSpec[]): void {
  for (const field of fields) {
    switch (field.type) {
      case 'row':
      case 'collapsible':
        walkFields(field.fields ?? [], prefix, out)
        break
      case 'tabs':
        for (const tab of field.tabs ?? []) walkFields(tab.fields, tab.name ? [...prefix, tab.name] : prefix, out)
        break
      case 'group':
        if (field.name) walkFields(field.fields ?? [], [...prefix, field.name], out)
        break
      case 'array':
        if (field.name) walkFields(field.fields ?? [], [...prefix, field.name, '*'], out)
        break
      case 'relationship':
      case 'upload':
        // Polymorphic relations (relationTo as a list) are not used by this site and are not mapped.
        if (field.name && typeof field.relationTo === 'string') {
          out.push({ path: [...prefix, field.name], field: [...prefix, field.name].join('.'), target: field.relationTo, hasMany: field.hasMany === true })
        }
        break
      default:
        break
    }
  }
}

const SPECS: Record<string, RelationSpec[]> = {}

/** Relation fields of an exported collection, found from its field config. */
export function relationSpecsFor(collection: string): RelationSpec[] {
  if (!SPECS[collection]) {
    const config = COLLECTION_FIELDS[collection]
    const out: RelationSpec[] = []
    if (config) walkFields(config as unknown as FieldLike[], [], out)
    SPECS[collection] = out
  }
  return SPECS[collection] as RelationSpec[]
}

const COLLECTION_FIELDS: Record<string, unknown[]> = {
  pages: Pages.fields,
  posts: Posts.fields,
  products: Products.fields,
}

/* -------------------------------------------------------------------------- */
/* Walking a value along a path                                               */
/* -------------------------------------------------------------------------- */

/**
 * Replaces the value at `path` with the result of `change`. Returns a new
 * value; the input is not changed. A result of undefined removes the key.
 */
export async function mapAtPath(
  value: unknown,
  path: readonly string[],
  change: (current: unknown) => Promise<unknown>,
): Promise<unknown> {
  if (path.length === 0) return change(value)
  const [head, ...rest] = path
  if (head === '*') {
    if (!Array.isArray(value)) return value
    return Promise.all(value.map((item) => mapAtPath(item, rest, change)))
  }
  const key: string = head
  if (!isPlainObject(value) || !(key in value)) return value
  const next: JsonObject = { ...value }
  const child = await mapAtPath(value[key], rest, change)
  if (child === undefined) delete next[key]
  else next[key] = child
  return next
}

/* -------------------------------------------------------------------------- */
/* Export: ids to names                                                       */
/* -------------------------------------------------------------------------- */

const LIST_LIMIT = 10000

/**
 * Turns the relation ids of content records into names, for the export file.
 * A relation to a record with no name in its key field is left out with a warning.
 */
export async function nameRelationsForExport(
  engine: Engine,
  collection: string,
  docs: JsonObject[],
  warnings: string[],
): Promise<JsonObject[]> {
  const specs = relationSpecsFor(collection)
  if (specs.length === 0) return docs.map((doc) => withoutKeys(doc, [...DOC_NOISE_KEYS, ...LINK_META_KEYS]))

  const names = new Map<string, Promise<Map<unknown, string>>>()
  const namesOf = (target: string): Promise<Map<unknown, string>> => {
    let found = names.get(target)
    if (!found) {
      found = (async () => {
        const result = await engine.find({ collection: target, limit: LIST_LIMIT, depth: 0, overrideAccess: true })
        const map = new Map<unknown, string>()
        const field = keyFieldFor(target)
        for (const row of (result.docs ?? []) as JsonObject[]) {
          const name = row[field]
          if (typeof name === 'string' && name.trim()) map.set(row.id, name.trim())
        }
        return map
      })()
      names.set(target, found)
    }
    return found
  }

  const out: JsonObject[] = []
  for (const doc of docs) {
    const label = (typeof doc.slug === 'string' && doc.slug) || (typeof doc.title === 'string' && doc.title) || String(doc.id)
    let next = withoutKeys(doc, [...DOC_NOISE_KEYS, ...LINK_META_KEYS])
    for (const spec of specs) {
      const field = spec.field
      next = (await mapAtPath(next, spec.path, async (current) => {
        if (current === undefined || current === null) return current
        const map = await namesOf(spec.target)
        const ids = Array.isArray(current) ? current : [current]
        const named: string[] = []
        for (const id of ids) {
          const name = map.get(id)
          if (name) named.push(name)
          else warnings.push(`${label}: ${field} points to a record with no ${keyFieldFor(spec.target)} in ${spec.target}, so it is left out of the export.`)
        }
        if (!Array.isArray(current)) return named[0] ?? null
        return named
      })) as JsonObject
    }
    out.push(next)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* Import: names to ids                                                       */
/* -------------------------------------------------------------------------- */

export type LinkContext = {
  engine: Engine
  file: ExportFile
  mode: 'plan' | 'apply'
  sections: readonly ImportSection[]
  /** Ids already found on this site, so each name is looked up once. */
  found: Map<string, number>
}

async function findByName(engine: Engine, collection: string, value: string): Promise<number | null> {
  const field = keyFieldFor(collection)
  const result = await engine.find({
    collection,
    where: { [field]: { equals: value } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = result.docs?.[0] as JsonObject | undefined
  return doc && typeof doc.id === 'number' ? doc.id : null
}

/** Whether the file itself will create the named record in this run (dry run only sees the file). */
function plannedInThisRun(ctx: LinkContext, target: string, name: string): boolean {
  const source = FILE_RECORDS[target]
  if (!source || !ctx.sections.includes(source.section)) return false
  const field = keyFieldFor(target)
  return source.records(ctx.file).some((record) => {
    const value = record[field]
    return typeof value === 'string' && normaliseName(target, value) === normaliseName(target, name)
  })
}

const normaliseName = (target: string, value: string): string => (target === 'users' ? value.trim().toLowerCase() : value.trim())

/** The id of the record a name points at on this site, 'planned' in a dry run when the file will create it, or null. */
async function idForName(ctx: LinkContext, target: string, name: string): Promise<number | 'planned' | null> {
  const value = normaliseName(target, name)
  const cacheKey = `${target}\u0000${value}`
  const cached = ctx.found.get(cacheKey)
  if (cached !== undefined) return cached

  const id = await findByName(ctx.engine, target, value)
  if (id !== null) {
    ctx.found.set(cacheKey, id)
    return id
  }
  if (ctx.mode === 'plan' && plannedInThisRun(ctx, target, value)) return 'planned'
  return null
}

/**
 * Turns the names in a content record back into ids on this site. A name with
 * no match is left unlinked and a warning is added to `warn`; the rest of the
 * record is still written.
 */
export async function linkRelationsForImport(
  ctx: LinkContext,
  collection: string,
  data: JsonObject,
  warn: (message: string) => void,
): Promise<JsonObject> {
  let next = data
  for (const spec of relationSpecsFor(collection)) {
    next = (await mapAtPath(next, spec.path, async (current) => {
      if (current === undefined || current === null) return current
      const values: unknown[] = Array.isArray(current) ? current : [current]
      const ids: number[] = []
      let missing = 0
      for (const value of values) {
        if (typeof value !== 'string' || !value.trim()) {
          // A number is an id from another database (an older export): it means nothing here.
          warn(`${spec.field} holds an id from another site, not a ${keyFieldFor(spec.target)}, so it was not linked.`)
          missing += 1
          continue
        }
        const hit = await idForName(ctx, spec.target, value)
        if (typeof hit === 'number') ids.push(hit)
        else if (hit === 'planned') ids.push(0)
        else {
          warn(`${spec.field}: no ${spec.target} with ${keyFieldFor(spec.target)} "${value.trim()}" on this site, so it was not linked.`)
          missing += 1
        }
      }
      if (!Array.isArray(current)) return ids[0] ?? undefined
      // Every name missing: leave the field as it is rather than clearing it.
      if (values.length > 0 && missing === values.length) return undefined
      return ids
    })) as JsonObject
  }
  return next
}

/**
 * Orders records so that a parent comes before its children (by name), so a
 * child can link to a parent created earlier in the same import.
 */
export function parentsFirst(
  items: JsonObject[],
  nameOf: (item: JsonObject) => string | null,
  parentOf: (item: JsonObject) => string | null,
): JsonObject[] {
  const byName = new Map<string, JsonObject>()
  for (const item of items) {
    const name = nameOf(item)
    if (name && !byName.has(name)) byName.set(name, item)
  }
  const out: JsonObject[] = []
  const placed = new Set<JsonObject>()
  const visiting = new Set<JsonObject>()
  const place = (item: JsonObject): void => {
    if (placed.has(item) || visiting.has(item)) return
    visiting.add(item)
    const parentName = parentOf(item)
    const parent = parentName ? byName.get(parentName) : undefined
    if (parent && parent !== item) place(parent)
    visiting.delete(item)
    placed.add(item)
    out.push(item)
  }
  for (const item of items) place(item)
  return out
}
