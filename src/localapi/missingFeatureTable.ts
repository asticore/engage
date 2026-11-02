import { ownerOfTable } from '@/features/featureTables'

/**
 * Runs a read and answers `empty()` when it failed only because the table of a
 * feature that has not been provisioned yet does not exist (D1: "no such table:
 * eg_products"). A section that is off keeps no tables on a fresh install, so a
 * public page, a list, the sitemap, search or a cron job that asks for its rows
 * must see "none", not an error. Core tables are never covered: a missing core
 * table is a real fault and still throws.
 */
export async function readOrEmptyWhenFeatureTableMissing<T>(read: () => Promise<T>, empty: () => T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    if (isMissingFeatureTable(error)) return empty()
    throw error
  }
}

export function isMissingFeatureTable(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? '')}` : String(error)
  const match = text.match(/no such table:?\s+[`"]?([A-Za-z0-9_]+)/i)
  return Boolean(match && ownerOfTable(match[1]) !== 'core')
}
