/**
 * The page cache version the Worker last read, shared through globalThis because the Worker entry and the
 * Next server are separate bundles. Kept in its own file with no imports so the Worker entry can use it.
 * Undefined when the page cache is off or the settings could not be read (see renderMemo.ts).
 */
export const currentEpoch = (): number | undefined => (globalThis as { __egEpoch?: number }).__egEpoch

export const publishEpoch = (epoch: number | undefined): void => {
  ;(globalThis as { __egEpoch?: number }).__egEpoch = epoch
}
