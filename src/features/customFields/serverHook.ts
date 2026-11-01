import { ValidationError } from '@/localapi/operations'

import { loadBlogSwitches } from '@/features/blog/switches'
import { definitionsFor, applyDefaults, validateFieldValues } from './validate'
import type { CustomFieldDef } from '@/fields/customFields/types'
import { loadFieldGroups, locationContextFor } from './server'
import { pruneHiddenValues } from './conditions'

/**
 * The write-time half of custom fields, called by the beforeValidate hook on
 * the shared `customFields` field (src/fields/customFields.ts).
 *
 * - Loads the groups. If that fails: a signed-in non-admin's save is refused
 *   (fail closed); an admin's, or a system write's, goes through untouched.
 * - Only groups whose location matches this document apply. Groups that do not
 *   use a role rule apply whoever is saving; role rules are checked against the saver.
 * - Create: fills defaults. Update with no customFields in the payload: nothing
 *   to write, so the stored values are kept; if the save publishes the document,
 *   the stored values are validated too.
 * - Drops values of fields hidden by their conditions, then validates the rest.
 */
export async function prepareCustomFieldsForSave({
  collection,
  operation,
  value,
  doc,
  userRoles,
  engine,
}: {
  collection: string
  operation: 'create' | 'update'
  value: unknown
  doc: Record<string, unknown>
  userRoles?: string[] | null
  /** Used to check that picture and file fields hold real media of the right kind. */
  engine?: MediaLookupEngine | null
}): Promise<unknown> {
  // A signed-in user who is not an admin. System writes (no user) and admins are not in this group.
  const nonAdminUser = userRoles !== undefined && userRoles !== null && !userRoles.includes('admin')

  let groups
  try {
    groups = await loadFieldGroups()
  } catch (error) {
    console.error('custom fields: could not load field groups', error)
    if (nonAdminUser) {
      throw new ValidationError([{ path: 'customFields', message: 'Custom fields could not be validated; try again.' }])
    }
    return value
  }

  const defs = definitionsFor(groups, locationContextFor(collection, doc, userRoles ?? null, { tags: collection === 'posts' ? (await loadBlogSwitches()).tags : true }))
  if (defs.length === 0) return value

  // A save that publishes must check what is stored, even when the payload leaves customFields out.
  const publishes = doc._status === 'published'
  if (value === undefined && operation === 'update' && !publishes) return value

  const source = value === undefined ? doc.customFields : value
  let values: Record<string, unknown> = source && typeof source === 'object' && !Array.isArray(source) ? { ...(source as Record<string, unknown>) } : {}
  if (operation === 'create') values = applyDefaults(defs, values)
  values = pruneHiddenValues(defs, values)

  const problems = validateFieldValues(defs, values)
  if (problems.length === 0) {
    for (const media of await mediaProblems(defs, values, engine)) problems.push({ field: media.path, path: media.path, message: media.message })
  }
  if (problems.length > 0) {
    throw new ValidationError(problems.map((p) => ({ path: p.path, message: p.message })))
  }
  if (value === undefined && operation === 'update') return value
  return values
}

type MediaLookupEngine = { find: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }> }

/**
 * The picture and file fields are checked on the server, not only in the editor: an image field must hold
 * media that exists and is a picture, a file field must hold media that exists, and a gallery must hold
 * pictures. A bare web address is still accepted by the field types that allow one (see validate.ts).
 * Without an engine the check is skipped (tests and tooling); a failed lookup refuses the save.
 */
export async function mediaProblems(
  defs: CustomFieldDef[],
  values: Record<string, unknown>,
  engine: MediaLookupEngine | null | undefined,
): Promise<Array<{ path: string; message: string }>> {
  const checks: Array<{ name: string; kind: 'image' | 'file' | 'gallery'; ids: number[] }> = []
  for (const def of defs) {
    const value = values[def.name]
    if (def.type === 'image' || def.type === 'file') {
      const id = Number(value)
      if (Number.isInteger(id) && id > 0) checks.push({ name: def.name, kind: def.type, ids: [id] })
    } else if (def.type === 'gallery' && Array.isArray(value)) {
      const ids = value.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0)
      if (ids.length > 0) checks.push({ name: def.name, kind: 'gallery', ids })
    }
  }
  if (checks.length === 0 || !engine) return []

  const wanted = [...new Set(checks.flatMap((check) => check.ids))]
  let mimeById: Map<number, string>
  try {
    const { docs } = await engine.find({ collection: 'media', where: { id: { in: wanted } }, limit: wanted.length, depth: 0, overrideAccess: true })
    mimeById = new Map(docs.map((doc) => [Number(doc.id), typeof doc.mimeType === 'string' ? doc.mimeType : '']))
  } catch {
    throw new ValidationError([{ path: 'customFields', message: 'Custom fields could not be validated; try again.' }])
  }

  const problems: Array<{ path: string; message: string }> = []
  for (const check of checks) {
    const missing = check.ids.some((id) => !mimeById.has(id))
    if (missing) {
      problems.push({ path: check.name, message: 'must be a media item that exists in the media library' })
      continue
    }
    if (check.kind !== 'file' && check.ids.some((id) => !(mimeById.get(id) ?? '').startsWith('image/'))) {
      problems.push({ path: check.name, message: check.kind === 'gallery' ? 'must only hold pictures' : 'must be a picture' })
    }
  }
  return problems
}
