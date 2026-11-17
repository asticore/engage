import type { D1 } from './userBansStore'
import type { SeenPair } from './loginAlert'

type Row = Record<string, unknown>

export async function listSeen(d1: D1, userId: number): Promise<SeenPair[]> {
  const rows = (await d1.prepare('SELECT device, country FROM eg_login_seen WHERE user_id = ?1 LIMIT 200').bind(userId).all<Row>()).results
  return rows.map((r) => ({ device: String(r.device ?? ''), country: String(r.country ?? '') }))
}

export async function markSeen(d1: D1, userId: number, device: string, country: string, at: string): Promise<void> {
  await d1
    .prepare('INSERT INTO eg_login_seen (user_id, device, country, first_seen, last_seen) VALUES (?1,?2,?3,?4,?4) ON CONFLICT(user_id, device, country) DO UPDATE SET last_seen = ?4')
    .bind(userId, device, country, at)
    .run()
}
