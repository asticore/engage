import type { SectionNode } from '@/lib/sectionTree'

import { comparableTree } from './blockDraft'

/**
 * Whether the editor has unsaved changes after the tree was swapped (undo / redo / history jump).
 * Clean only when the tree equals the saved one AND nothing outside the tree (locks, page settings,
 * form config) changed. Before the document has loaded (`savedTree === null`) it stays dirty.
 */
export function isDirtyAfterRestore(blocks: SectionNode[], savedTree: string | null, extraDirty: boolean): boolean {
  if (extraDirty || savedTree === null) return true
  return comparableTree(blocks) !== savedTree
}
