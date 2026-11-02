'use server'

/**
 * What the Unused tables screen calls. Same boundary as actions.ts: the admin
 * session is checked here (this is the one and only super admin check; there is
 * no role above `admin`), and unusedTables.ts re-checks the table itself.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { getEngine } from '@/lib/engine'
import { recordAuditEvent } from '@/features/security/auditLog'
import { getSecuritySettings } from '@/features/security/settings'
import { ownerOfTable } from '@/features/featureTables'
import { setFeatureState } from '@/migrations/schema/featureTablesState'
import { getFeatureFlags } from '@/utilities/features'

import { getCleanupDb } from './guard'
import { dropUnusedTable, exportUnusedTable, type DropOutcome, type TableExport } from './unusedTables'

type AdminIdentity = { id: number | string | null; email: string | null }

async function adminIdentity(): Promise<AdminIdentity | null> {
  try {
    const engine = await getEngine()
    const { user } = await engine.auth({ headers: await headers() })
    const record = user as { id?: number | string; email?: string; roles?: string[] } | null
    if (!record?.roles?.includes('admin')) return null
    return { id: record.id ?? null, email: record.email ?? null }
  } catch {
    return null
  }
}

export async function exportUnusedTableAction(table: string): Promise<TableExport> {
  const empty: TableExport = { ok: false, reason: 'not-permitted', table, rows: 0, truncated: false, json: '' }
  if (!(await adminIdentity())) return empty
  const db = await getCleanupDb()
  if (!db) return { ...empty, reason: 'no-database' }
  return exportUnusedTable(db, await getFeatureFlags(), table)
}

export async function dropUnusedTableAction(table: string, typed: string): Promise<DropOutcome> {
  const refused = (reason: string): DropOutcome => ({ ok: false, reason, table, rowsDropped: 0 })
  const admin = await adminIdentity()
  if (!admin) return refused('not-permitted')
  const db = await getCleanupDb()
  if (!db) return refused('no-database')

  const outcome = await dropUnusedTable(db, await getFeatureFlags(), table, typed)

  if (outcome.ok) {
    // The feature no longer has all its tables: switching it on again must create them again.
    const owner = ownerOfTable(table)
    if (owner !== 'core') {
      try {
        const { env } = await getCloudflareContext({ async: true })
        if (env.D1) await setFeatureState(env.D1, owner, 'deferred')
      } catch {
        // The state row is bookkeeping; the drop itself already happened and is audited below.
      }
    }
    // Always written, whatever the Security settings say: dropping a table is not optional to record.
    const engine = await getEngine()
    const settings = await getSecuritySettings(engine as unknown as Parameters<typeof getSecuritySettings>[0])
    await recordAuditEvent(
      {
        action: 'database.table-dropped',
        actorId: admin.id,
        actorEmail: admin.email,
        detail: `dropped ${table} (${outcome.rowsDropped} row${outcome.rowsDropped === 1 ? '' : 's'}; feature ${owner})`,
      },
      { ...settings, featureEnabled: true, auditLog: { ...settings.auditLog, enabled: true } },
    )
    revalidatePath('/admin/unused-tables')
    revalidatePath('/admin/database')
  }
  return outcome
}
