import { rawD1 } from '@/features/ecommerce/server/db'
import { scanMediaUsage, type UsageEngine } from '@/features/media/usage'
import { ValidationError } from '@/localapi/operations'
import { deleteMediaKeys } from '@/localapi/storage'
import { getFeatureFlags } from '@/utilities/features'

import * as store from './store'

/** Set on the engine call that deletes a file on purpose even though it is in use. */
export const ALLOW_USED_DELETE = 'allowUsedDelete'

/** Words for the refusal. Pure so it can be tested. */
export function usedMessage(count: number, titles: string[]): string {
  const where = titles.slice(0, 3).join(', ')
  return `This file is used in ${count} place${count === 1 ? '' : 's'}${where ? ` (${where}${count > 3 ? ' and more' : ''})` : ''}. Replace it everywhere or remove it from those places first, or delete it anyway from its Asset manager panel.`
}

/** Refuses to delete a file that is in use, when the asset manager is on and Warn before deleting is set. */
export async function guardUsedMedia(id: number, context: Record<string, unknown> | undefined, engine: unknown): Promise<void> {
  if (context?.[ALLOW_USED_DELETE] === true || !engine) return
  let settings: store.Settings
  try {
    if (!(await getFeatureFlags()).dam) return
    settings = await store.getSettings((await rawD1()) as never as store.D1)
  } catch {
    return
  }
  if (!settings.blockUsedDelete) return
  const report = await scanMediaUsage(engine as UsageEngine, id).catch((): null => null)
  if (report && report.count > 0) throw new ValidationError([{ path: 'id', message: usedMessage(report.count, report.references.map((r) => r.title)) }])
}

/** After a delete: drop the asset manager's records for the file and its stored versions. Never throws. */
export async function cleanupDeletedMedia(id: number): Promise<void> {
  try {
    if (!(await getFeatureFlags()).dam) return
    const keys = await store.purgeAsset((await rawD1()) as never as store.D1, id)
    await deleteMediaKeys(keys)
  } catch (error) {
    console.error('Tidying a deleted file failed:', error)
  }
}
