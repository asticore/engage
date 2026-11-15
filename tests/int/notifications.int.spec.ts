import { describe, expect, it } from 'vitest'

import { runNotifications, type NotificationDeps } from '@/features/notifications/dispatch'
import { parseRule, resolveRecipient, type NotificationRule } from '@/features/notifications/rules'
import { MERGE_TAGS, notificationValues } from '@/features/notifications/triggers'

const rule = (over: Partial<NotificationRule>): NotificationRule => ({ id: 1, name: 'r', event: 'order.paid', channel: 'email', recipient: 'customer', customTo: '', subject: 'Receipt {{order_id}}', body: 'Hi, total {{amount}} at {{site_name}}', enabled: true, ...over })

const deps = (rules: NotificationRule[], extra: Partial<NotificationDeps> = {}) => {
  const sent: { to: string; subject: string; text: string; template: string }[] = []
  const pushes: { title: string; body: string }[] = []
  const d: NotificationDeps = {
    listRules: async () => rules,
    siteName: async () => 'Shop',
    adminEmail: async () => 'admin@example.com',
    sendEmail: async (args) => { sent.push(args) },
    sendPush: async (args) => { pushes.push(args) },
    ...extra,
  }
  return { d, sent, pushes }
}

describe('notification rules', () => {
  it('sends the receipt to the customer with tags filled', async () => {
    const { d, sent } = deps([rule({})])
    expect(await runNotifications(d, 'order.paid', { id: 7, amount: 1200, customerEmail: 'c@example.com' })).toBe(1)
    expect(sent[0]).toMatchObject({ to: 'c@example.com', subject: 'Receipt 7', text: 'Hi, total 1200 at Shop', template: 'notification.order.paid' })
  })
  it('skips off rules, other events, and customers with no address', async () => {
    const { d, sent } = deps([rule({ enabled: false }), rule({ event: 'user.registered', recipient: 'admin' })])
    expect(await runNotifications(d, 'order.paid', { id: 1, customerEmail: 'c@example.com' })).toBe(0)
    const none = deps([rule({})])
    expect(await runNotifications(none.d, 'order.paid', { id: 1 })).toBe(0)
    expect(sent).toHaveLength(0)
    expect(await runNotifications(d, 'not.an.event', {})).toBe(0)
  })
  it('sends a push rule through the push channel and one failing rule does not stop the rest', async () => {
    const { d, pushes, sent } = deps([rule({ channel: 'push', recipient: 'admin', subject: 'New order', body: '{{order_id}}' }), rule({ id: 2 })], { sendEmail: async () => { throw new Error('down') } })
    expect(await runNotifications(d, 'order.paid', { id: 9, customerEmail: 'c@example.com' })).toBe(1)
    expect(pushes).toEqual([{ title: 'New order', body: '9' }])
    expect(sent).toHaveLength(0)
  })
  it('fills form answers one per line', () => {
    expect(notificationValues('form.submitted', { id: 1, formTitle: 'Contact', values: { name: 'Ann', msg: 'Hi' } }, 'S').fields).toBe('name: Ann\nmsg: Hi')
    for (const tags of Object.values(MERGE_TAGS)) expect(tags.length).toBeGreaterThan(2)
  })
  it('validates a rule and resolves recipients', () => {
    expect(parseRule({ name: '', event: 'order.paid' }).ok).toBe(false)
    expect(parseRule({ name: 'x', event: 'form.submitted', channel: 'email', recipient: 'customer', subject: 's', body: 'b' })).toMatchObject({ ok: false })
    expect(parseRule({ name: 'x', event: 'order.paid', channel: 'email', recipient: 'custom', customTo: 'bad', subject: 's', body: 'b' })).toMatchObject({ ok: false })
    expect(parseRule({ name: 'x', event: 'order.paid', channel: 'push', subject: 's', body: 'b' })).toMatchObject({ ok: true })
    expect(resolveRecipient(rule({ recipient: 'admin' }), 'c@example.com', 'a@example.com')).toBe('a@example.com')
    expect(resolveRecipient(rule({ recipient: 'admin' }), 'c@example.com', '')).toBe('')
  })
})
