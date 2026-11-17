import type { EmailBrand } from '@/features/email/design/brand'
import { renderEmailHtml } from '@/features/email/design/render'
import { renderEmailText } from '@/features/email/design/renderText'
import { fillTemplate, textToHtml } from '@/features/email/renderTemplate'

import { resolveRecipient, rulesFor, type NotificationRule } from './rules'
import { customerAddress, isNotificationTrigger, notificationValues } from './triggers'

export type NotificationDeps = {
  listRules: () => Promise<NotificationRule[]>
  siteName: () => Promise<string>
  adminEmail: () => Promise<string>
  /** The Email design brand. Absent in tests; a rule with the brand layout then stays plain. */
  brand?: () => Promise<EmailBrand>
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
    const brand = rules.some((r) => r.channel === 'email' && r.layout === 'brand') && deps.brand ? await deps.brand().catch((): null => null) : null
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
          // The brand layout only applies once Email design has the brand switched on; otherwise the rule stays plain.
          if (rule.layout === 'brand' && brand?.enabled) {
            const body = [{ type: 'text' as const, text: rule.body, align: 'left' as const }]
            await deps.sendEmail({ to, subject, text: renderEmailText(body, brand, values), html: renderEmailHtml(body, brand, { vars: values }), template: `notification.${event}` })
          } else {
            await deps.sendEmail({ to, subject, text, html: textToHtml(text), template: `notification.${event}` })
          }
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
