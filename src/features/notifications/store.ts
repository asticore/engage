import { isNotificationTrigger } from './triggers'
import type { NotificationRule } from './rules'

type D1 = { prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> } } }

const COLUMNS = 'id, name, event, channel, recipient, custom_to, subject, body, enabled'

/** Reads every notification rule. A missing table means no rules, so the site keeps working. */
export async function listRules(d1: D1): Promise<NotificationRule[]> {
  try {
    const rows = (await d1.prepare(`SELECT ${COLUMNS} FROM eg_notification_rules ORDER BY id`).bind().all<Record<string, unknown>>()).results
    const out: NotificationRule[] = []
    for (const r of rows) {
      if (!isNotificationTrigger(r.event)) continue
      out.push({
        id: Number(r.id),
        name: String(r.name ?? ''),
        event: r.event,
        channel: r.channel === 'push' ? 'push' : 'email',
        recipient: r.recipient === 'customer' || r.recipient === 'custom' ? r.recipient : 'admin',
        customTo: String(r.custom_to ?? ''),
        subject: String(r.subject ?? ''),
        body: String(r.body ?? ''),
        enabled: Number(r.enabled) !== 0,
      })
    }
    return out
  } catch {
    return []
  }
}

export async function saveRule(d1: D1, rule: NotificationRule, nowIso: string): Promise<void> {
  const values = [rule.name, rule.event, rule.channel, rule.recipient, rule.customTo, rule.subject, rule.body, rule.enabled ? 1 : 0, nowIso]
  if (rule.id) {
    await d1.prepare('UPDATE eg_notification_rules SET name=?1, event=?2, channel=?3, recipient=?4, custom_to=?5, subject=?6, body=?7, enabled=?8, updated_at=?9 WHERE id=?10').bind(...values, rule.id).run()
  } else {
    await d1.prepare('INSERT INTO eg_notification_rules (name, event, channel, recipient, custom_to, subject, body, enabled, updated_at, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)').bind(...values).run()
  }
}

export async function deleteRule(d1: D1, id: number): Promise<void> {
  await d1.prepare('DELETE FROM eg_notification_rules WHERE id = ?1').bind(id).run()
}
