import type { CustomFieldDef, FieldGroupDoc } from '@/fields/customFields/types'
import type { LocationContext } from '@/features/customFields/location'
import { pruneHiddenValues } from '@/features/customFields/conditions'
import { definitionsFor } from '@/features/customFields/validate'
import { isSelectableCustomField } from '@/features/dataViews/catalogue'
import { CUSTOM_KEY_PREFIX, isCustomKey } from './core'

/**
 * Custom fields (`cf:<name>`) for the API. The same rules the admin screens use decide what an account
 * may see and write on a record: only the field groups whose location (including role rules, checked
 * against the key owner's roles) apply to that record, only values not hidden by their conditions, and
 * the group's own validation runs in the save hook (src/features/customFields/serverHook.ts).
 */

export type CustomDeps = {
  loadGroups: () => Promise<FieldGroupDoc[]>
  /** The location context of a record for these roles. The production wiring uses the admin's own context. */
  locate: (collection: string, doc: Record<string, unknown>, roles: readonly string[]) => LocationContext
}

async function definitionsOn(deps: CustomDeps, collection: string, doc: Record<string, unknown>, roles: readonly string[]): Promise<CustomFieldDef[]> {
  const groups = await deps.loadGroups()
  return definitionsFor(groups, deps.locate(collection, doc, roles)).filter(isSelectableCustomField)
}

/** The custom values of one record that the owner of the key may read. Keys are the field names, without `cf:`. */
export async function readCustomValues(deps: CustomDeps, collection: string, doc: Record<string, unknown>, roles: readonly string[]): Promise<Record<string, unknown>> {
  const defs = await definitionsOn(deps, collection, doc, roles)
  if (defs.length === 0) return {}
  const stored = doc.customFields && typeof doc.customFields === 'object' && !Array.isArray(doc.customFields) ? (doc.customFields as Record<string, unknown>) : {}
  const visible = pruneHiddenValues(defs, stored)
  const out: Record<string, unknown> = {}
  for (const def of defs) {
    if (Object.prototype.hasOwnProperty.call(visible, def.name) && visible[def.name] !== undefined) out[def.name] = visible[def.name]
  }
  return out
}

export type CustomWrite = { ok: true; values: Record<string, unknown> } | { ok: false; field: string }

/**
 * The `cf:` keys of a request body, as field names. A key that no field group applies to this record
 * for this account is refused (the whole request is refused, so nothing is half-written).
 */
export async function customWriteValues(deps: CustomDeps, collection: string, doc: Record<string, unknown>, roles: readonly string[], body: Record<string, unknown>): Promise<CustomWrite> {
  const keys = Object.keys(body).filter(isCustomKey)
  if (keys.length === 0) return { ok: true, values: {} }
  const defs = await definitionsOn(deps, collection, doc, roles)
  const values: Record<string, unknown> = {}
  for (const key of keys) {
    const name = key.slice(CUSTOM_KEY_PREFIX.length)
    if (!defs.some((def) => def.name === name)) return { ok: false, field: key }
    values[name] = body[key]
  }
  return { ok: true, values }
}
