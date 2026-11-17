import type { D1 } from './userBansStore'
import { banUser, unbanUser } from './userBansStore'
import { userBulkRefusal, type UserBulkAction } from './userBulk'

type Row = Record<string, unknown>
export type UserBulkResult = { id: number; email: string; ok: boolean; error?: string }

async function loadUsers(d1: D1, ids: number[]): Promise<Array<{ id: number; email: string; roles: string[] }>> {
  const marks = ids.map((_, i) => `?${i + 1}`).join(',')
  const users = (await d1.prepare(`SELECT id, email FROM eg_users WHERE id IN (${marks})`).bind(...ids).all<Row>()).results
  const roles = (await d1.prepare(`SELECT parent_id, value FROM eg_users_roles WHERE parent_id IN (${marks})`).bind(...ids).all<Row>()).results
  return users.map((u) => ({
    id: Number(u.id),
    email: String(u.email ?? ''),
    roles: roles.filter((r) => Number(r.parent_id) === Number(u.id)).map((r) => String(r.value ?? '')),
  }))
}

/** Runs one action over the chosen users, row by row, so one refusal never stops the rest. */
export async function runUserBulk(
  d1: D1,
  v: { action: UserBulkAction; ids: number[]; reason: string; days: number | null; role: string; actorId: number; actorEmail: string },
  nowIso: string,
): Promise<UserBulkResult[]> {
  const users = await loadUsers(d1, v.ids)
  const byId = new Map(users.map((u) => [u.id, u]))
  const out: UserBulkResult[] = []
  for (const id of v.ids) {
    const user = byId.get(id)
    if (!user) {
      out.push({ id, email: `#${id}`, ok: false, error: 'No such user.' })
      continue
    }
    const refusal = userBulkRefusal(v.action, user, v.actorId)
    if (refusal) {
      out.push({ id, email: user.email, ok: false, error: refusal })
      continue
    }
    try {
      if (v.action === 'ban') await banUser(d1, { userId: id, reason: v.reason, days: v.days, by: v.actorEmail }, nowIso)
      else if (v.action === 'unban') await unbanUser(d1, id)
      else if (v.action === 'revokeSessions') await d1.prepare('DELETE FROM eg_users_sessions WHERE _parent_id = ?1').bind(id).run()
      else {
        await d1.prepare('DELETE FROM eg_users_roles WHERE parent_id = ?1').bind(id).run()
        await d1.prepare('INSERT INTO eg_users_roles (`order`, parent_id, value) VALUES (1, ?1, ?2)').bind(id, v.role).run()
        await d1.prepare('DELETE FROM eg_users_sessions WHERE _parent_id = ?1').bind(id).run()
      }
      out.push({ id, email: user.email, ok: true })
    } catch {
      out.push({ id, email: user.email, ok: false, error: 'Could not save.' })
    }
  }
  return out
}
