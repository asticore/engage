import { viewerFor, type D1 as FolderD1 } from '@/features/media/folderRecordsStore'

import { checkQuota } from './quota'
import * as store from './store'

/** Returns a refusal message when storing `incoming` bytes would pass the site limit or a role or company quota, else null. Never throws. */
export async function quotaRefusal(d1: store.D1, user: unknown, isAdmin: boolean, incoming: number): Promise<string | null> {
  try {
    const settings = await store.getSettings(d1)
    if (settings.quotaMb === 0 && settings.quotas.length === 0) return null
    const viewer = await viewerFor(d1 as never as FolderD1, user as never, isAdmin)
    const siteUsed = settings.quotaMb > 0 ? await store.siteBytes(d1) : 0
    const usage = new Map<string, number>()
    for (const q of settings.quotas) {
      const applies = q.scope === 'role' ? viewer.roles.includes(q.key) : viewer.companyIds.includes(q.key)
      if (applies) usage.set(`${q.scope}:${q.key}`, await store.quotaUsage(d1, q))
    }
    const result = checkQuota({ incoming, siteLimitMb: settings.quotaMb, siteUsed, quotas: settings.quotas, roles: viewer.roles, companyIds: viewer.companyIds, used: (q) => usage.get(`${q.scope}:${q.key}`) ?? 0 })
    return result.ok === false ? result.error : null
  } catch (error) {
    console.error('Quota check failed; the upload goes on:', error)
    return null
  }
}
