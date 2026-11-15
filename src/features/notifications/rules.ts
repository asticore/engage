import { isNotificationTrigger, NOTIFICATION_TRIGGERS, type NotificationTrigger } from './triggers'

export type NotificationChannel = 'email' | 'push'
export type NotificationRecipient = 'customer' | 'admin' | 'custom'

export type NotificationRule = {
  id?: number
  name: string
  event: NotificationTrigger
  channel: NotificationChannel
  recipient: NotificationRecipient
  customTo: string
  subject: string
  body: string
  enabled: boolean
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Cleans one rule from request data, or says what is wrong with it. */
export function parseRule(input: unknown): { ok: true; rule: NotificationRule } | { ok: false; error: string } {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const name = str(r.name)
  if (!name) return { ok: false, error: 'Give the notification a name.' }
  if (!isNotificationTrigger(r.event)) return { ok: false, error: 'Choose what starts this notification.' }
  const channel: NotificationChannel = r.channel === 'push' ? 'push' : 'email'
  const trigger = NOTIFICATION_TRIGGERS.find((t) => t.key === r.event)!
  const recipient: NotificationRecipient = r.recipient === 'customer' || r.recipient === 'custom' ? r.recipient : 'admin'
  if (channel === 'email' && !trigger.recipients.includes(recipient)) return { ok: false, error: 'That trigger has no customer to send to.' }
  const customTo = str(r.customTo)
  if (channel === 'email' && recipient === 'custom' && !EMAIL.test(customTo)) return { ok: false, error: 'Enter a valid email address.' }
  const subject = str(r.subject).replace(/[\r\n]+/g, ' ')
  const body = typeof r.body === 'string' ? r.body.trim() : ''
  if (!subject) return { ok: false, error: channel === 'push' ? 'Add the notification title.' : 'Add a subject.' }
  if (!body) return { ok: false, error: 'Add the message.' }
  const id = Number(r.id)
  return { ok: true, rule: { ...(Number.isInteger(id) && id > 0 ? { id } : {}), name, event: r.event, channel, recipient: channel === 'push' ? 'admin' : recipient, customTo: recipient === 'custom' ? customTo : '', subject, body, enabled: r.enabled !== false } }
}

/** Who an email rule goes to for this event, or '' when there is nobody (no customer address, no admin address). */
export function resolveRecipient(rule: NotificationRule, customer: string, admin: string): string {
  if (rule.recipient === 'customer') return EMAIL.test(customer) ? customer : ''
  if (rule.recipient === 'custom') return rule.customTo
  return EMAIL.test(admin) ? admin : ''
}

export const rulesFor = (rules: NotificationRule[], event: NotificationTrigger): NotificationRule[] => rules.filter((rule) => rule.enabled && rule.event === event)
