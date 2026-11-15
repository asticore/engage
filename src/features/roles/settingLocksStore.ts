import { parseSettingLock, type SettingLock } from './settingLocks'

type D1 = { prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } } }

const json = (v: unknown): unknown => {
  try {
    return typeof v === 'string' ? JSON.parse(v) : []
  } catch {
    return null
  }
}

/** Every setting lock. A missing table means no locks. A row whose lists cannot be read comes back malformed, which locks for admins only. */
export async function listSettingLocks(d1: D1): Promise<SettingLock[]> {
  try {
    const rows = (await d1.prepare('SELECT id, scope, target, groups, keys, unlock_roles FROM eg_setting_locks ORDER BY id').bind().all<Record<string, unknown>>()).results
    return rows.map((r) => {
      const groups = json(r.groups)
      const keys = json(r.keys)
      const roles = json(r.unlock_roles)
      if (groups === null || keys === null || roles === null) return parseSettingLock({ scope: 'broken' })
      return parseSettingLock({ id: r.id, scope: r.scope, target: r.target, groups, keys, unlockRoles: roles })
    })
  } catch {
    return []
  }
}

export async function saveSettingLock(d1: D1, lock: SettingLock, nowIso: string): Promise<void> {
  const values = [lock.scope, lock.target, JSON.stringify(lock.groups), JSON.stringify(lock.keys), JSON.stringify(lock.unlockRoles), nowIso]
  if (lock.id) await d1.prepare('UPDATE eg_setting_locks SET scope=?1, target=?2, groups=?3, keys=?4, unlock_roles=?5, updated_at=?6 WHERE id=?7').bind(...values, lock.id).run()
  else await d1.prepare('INSERT INTO eg_setting_locks (scope, target, groups, keys, unlock_roles, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?6,?6)').bind(...values).run()
}

export async function deleteSettingLock(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_setting_locks WHERE id = ?1').bind(id).run()
}
