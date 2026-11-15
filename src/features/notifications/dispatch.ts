import { fillTemplate, textToHtml } from '@/features/email/renderTemplate'

import { resolveRecipient, rulesFor, type NotificationRule } from './rules'
import { customerAddress, isNotificationTrigger, notificationValues } from './triggers'

export type NotificationDeps = {
  listRules: () => Promise<NotificationRule[]>
  siteName: () => Promise<string>
  adminEmail: () => Promise<string>
  sendEmail: (args: { to: string; subject: string; html: string; text: string; template: string }) => Promise<unknown>
  /** Sends a web push to everyone subscribed in the admin. Absent until push is set up. */
  sendPush?: (args: { title: string; body: string }) => Promise<unknown>
}

/**
 * Runs every enabled rule for one event. Never throws and never waits on a slow provider for the caller:
 * a failed rule is skipped so the others still go. Returns how many rules were sent, for tests.
 */
export async function runNotifications(deps: NotificationDeps, event: string, data: Record<string, unknown>): Promise<number> {
  if (!isNotificationTrigger(event)) return 0
  try {
    const rules = rulesFor(await deps.listRules(), event)
    if (rules.length === 0) return 0
    const values = notificationValues(event, data, await deps.siteName())
    const admin = await deps.adminEmail()
    const customer = customerAddress(data)
    let sent = 0
    for (const rule of rules) {
      try {
        const subject = fillTemplate(rule.subject, values).replace(/[\r\n]+/g, ' ')
        const text = fillTemplate(rule.body, values)
        if (rule.channel === 'push') {
          if (!deps.sendPush) continue
          await deps.sendPush({ title: subject, body: text })
        } else {
          const to = resolveRecipient(rule, customer, admin)
          if (!to) continue
          await deps.sendEmail({ to, subject, text, html: textToHtml(text), template: `notification.${event}` })
        }
        sent += 1
      } catch {
        // One broken rule must not stop the rest.
      }
    }
    return sent
  } catch {
    return 0
  }
}
