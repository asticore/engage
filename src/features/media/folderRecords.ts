/**
 * Media folders as records (Task 29a). A file still keeps its folder as a text path, so file addresses and the file
 * queries do not change. A record adds what a path alone cannot hold: colour, description, who may use the folder, and
 * defaults for new files. These helpers are pure; the database side is `folderRecordsStore.ts`.
 */
import { folderChain } from '@/features/dam/access'

import { MAX_FOLDER_LENGTH, sanitizeFolder } from './folders'

export type FolderRecord = {
  path: string
  color: string
  description: string
  allowedRoles: string[]
  allowedCompanies: string[]
  altPrefix: string
  defaultLicence: string
  visibility: 'inherit' | 'public' | 'private'
}

export const DEFAULT_COLOR = '#888888'

export const blankRecord = (path: string): FolderRecord => ({ path, color: DEFAULT_COLOR, description: '', allowedRoles: [], allowedCompanies: [], altPrefix: '', defaultLicence: '', visibility: 'inherit' })

/** A comma separated column to a clean list. */
export const listOf = (text: unknown): string[] =>
  typeof text === 'string' ? Array.from(new Set(text.split(',').map((v) => v.trim()).filter(Boolean))) : []
export const listText = (list: string[]): string => list.join(',')

const COLOR = /^#[0-9a-fA-F]{6}$/

/** Checks the fields an admin sent for a folder. The path is not part of it (it has its own rename and move). */
export function parseFolderFields(input: Record<string, unknown>): { ok: true; value: Omit<FolderRecord, 'path'> } | { ok: false; error: string } {
  const color = typeof input.color === 'string' && input.color ? input.color : DEFAULT_COLOR
  if (!COLOR.test(color)) return { ok: false, error: 'Choose a colour such as #1a73e8.' }
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (description.length > 300) return { ok: false, error: 'The description is up to 300 characters.' }
  const altPrefix = typeof input.altPrefix === 'string' ? input.altPrefix.trim() : ''
  if (altPrefix.length > 60) return { ok: false, error: 'The alt text start is up to 60 characters.' }
  const defaultLicence = typeof input.defaultLicence === 'string' ? input.defaultLicence.trim() : ''
  if (defaultLicence.length > 80) return { ok: false, error: 'The licence is up to 80 characters.' }
  const pick = (v: unknown): string[] => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && /^[\w\- .:@]{1,80}$/.test(x)))) : [])
  const visibility = input.visibility === 'public' || input.visibility === 'private' ? input.visibility : 'inherit'
  return { ok: true, value: { color, description, allowedRoles: pick(input.allowedRoles), allowedCompanies: pick(input.allowedCompanies), altPrefix, defaultLicence, visibility } }
}

export type Viewer = { isAdmin: boolean; roles: string[]; companyIds: string[] }

/** A folder is limited when it lists at least one role or company. */
export const isLimited = (r: FolderRecord | undefined): boolean => Boolean(r && (r.allowedRoles.length > 0 || r.allowedCompanies.length > 0))

/**
 * Whether the viewer may use a folder. The nearest folder (itself or a parent) that lists roles or companies decides:
 * a viewer needs one of the listed roles or to belong to one of the listed companies. Admins always may. No limited
 * folder anywhere on the path means everyone with media access may.
 */
export function mayUseFolder(records: FolderRecord[], path: string, viewer: Viewer): boolean {
  if (viewer.isAdmin) return true
  const byPath = new Map(records.map((r) => [r.path, r]))
  for (const p of folderChain(path)) {
    const record = byPath.get(p)
    if (!isLimited(record)) continue
    return Boolean(record && (record.allowedRoles.some((r) => viewer.roles.includes(r)) || record.allowedCompanies.some((c) => viewer.companyIds.includes(c))))
  }
  return true
}

/** Defaults for a new file in a folder: the nearest folder that sets each one wins. */
export function inheritedDefaults(records: FolderRecord[], path: string): { altPrefix: string; defaultLicence: string } {
  const byPath = new Map(records.map((r) => [r.path, r]))
  let altPrefix = ''
  let defaultLicence = ''
  for (const p of folderChain(path)) {
    const r = byPath.get(p)
    if (!r) continue
    if (!altPrefix && r.altPrefix) altPrefix = r.altPrefix
    if (!defaultLicence && r.defaultLicence) defaultLicence = r.defaultLicence
  }
  return { altPrefix, defaultLicence }
}

/** Puts a folder's alt text start in front of a drafted alt text, once. */
export function withAltPrefix(prefix: string, alt: string): string {
  if (!prefix || !alt) return alt
  const lower = alt.toLowerCase()
  return lower.startsWith(prefix.toLowerCase()) ? alt : `${prefix} ${alt}`.slice(0, 300)
}

/** The path a record takes when folder `from` becomes `to` ('' for deleting up a level is handled by the caller). */
export function movedPath(path: string, from: string, to: string): string | null {
  if (path === from) return to
  if (path.startsWith(`${from}/`)) return to ? `${to}${path.slice(from.length)}` : path.slice(from.length + 1)
  return null
}

/** The paths a record set holds once `path` and all its parents exist, so a nested folder always has its parents. */
export function withParents(paths: string[]): string[] {
  const out = new Set<string>()
  for (const p of paths) for (const c of folderChain(p)) out.add(c)
  return Array.from(out).sort((a, b) => a.localeCompare(b))
}

/** A new folder name inside a parent, checked like any folder path. */
export function newFolderPath(parent: string, name: string): { ok: true; path: string } | { ok: false; error: string } {
  const leaf = sanitizeFolder(name)
  if (!leaf || leaf.includes('/')) return { ok: false, error: 'Use a folder name without slashes: letters, numbers, spaces, hyphens and underscores.' }
  const path = parent ? `${parent}/${leaf}` : leaf
  if (path.length > MAX_FOLDER_LENGTH) return { ok: false, error: `Folder paths are up to ${MAX_FOLDER_LENGTH} characters.` }
  return { ok: true, path }
}
