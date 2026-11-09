/**
 * Template libraries: GitHub folders that hold ready-made sections and pages for the visual editor
 * and the Templates hub. Types only; nothing here touches the network or the database.
 *
 * A library is added by its GitHub address. The folder it points at holds a `library.json` file
 * (format `engage-library`) and the item files it lists. Older template repositories (a `manifest.json`
 * with `templates`, see src/features/templateRepos) are read as well, so they keep working.
 */

import type { ManifestTemplate, TemplateRepoConfig } from '@/features/templateRepos/types'

export type LibraryKind = 'page' | 'section'

/** One item of a library, as listed in its manifest. Same shape as a repository template entry. */
export type LibraryItem = ManifestTemplate

/** A parsed library manifest. `format` says which file it came from. */
export type LibraryManifest = {
  format: 'library' | 'legacy'
  name: string
  items: LibraryItem[]
}

/** One saved library row, validated. `config` is null when the saved address is not valid. */
export type LibraryRow = {
  /** True for the library every install ships with: it can be switched off but not removed. */
  builtIn?: boolean
  id: string
  label: string
  url: string
  enabled: boolean
  config: TemplateRepoConfig | null
  error: string | null
}

/** A library as the admin screens show it: its row plus what its manifest contained (or why it could not be read). */
export type LibrarySummary = Omit<LibraryRow, 'config'> & {
  name: string | null
  itemCount: number
  error: string | null
}

/** One item of the combined list used by the hub and the visual editor. */
export type LibraryItemRow = {
  key: string
  libraryId: string
  libraryLabel: string
  slug: string
  title: string
  kind: LibraryKind
  category: string
  tags: string[]
  previewUrl: string
}

/** The library every install lists by default (reference/references.json, id `engage-templates`). */
export const DEFAULT_LIBRARY_ID = 'engage-templates'
export const DEFAULT_LIBRARY_URL = 'https://github.com/asticore/engage-templates'
export const DEFAULT_LIBRARY_LABEL = 'Engage templates'

export const LIBRARY_LIMITS = {
  maxLibraries: 20,
  maxItems: 500,
  maxImports: 2000,
  urlMaxLength: 300,
  labelMaxLength: 80,
  tokenMaxLength: 400,
  cacheTtlMs: 5 * 60 * 1000,
} as const
