import { audit, auditContext } from './auditLog'
import { readSecuritySettingsFromD1 } from './settings'

/**
 * Records that someone downloaded data (action `export`), for the activity log.
 * Never throws and never delays the download for long: a missing log line is
 * better than a failed export. `what` is the short name of the file.
 */
export async function auditExport(request: Request, user: unknown, what: string): Promise<void> {
  try {
    const actor = user as { id?: number | string; email?: string } | null | undefined
    const settings = await readSecuritySettingsFromD1()
    const seen = auditContext(request)
    await audit({ action: 'export', actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, detail: what, ip: seen.ip, userAgent: seen.userAgent }, settings)
  } catch {
    // See auditLog.ts.
  }
}
