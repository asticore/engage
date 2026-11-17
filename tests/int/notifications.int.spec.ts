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

describe('stock, course and subscription notifications', () => {
  it('fills the tags for the new triggers from the event data', () => {
    expect(notificationValues('stock.low', { kind: 'low', label: 'Mug (blue)', sku: 'M-1', qty: 2 }, 'Shop')).toMatchObject({ product: 'Mug (blue)', sku: 'M-1', qty: '2', stock_kind: 'Low stock' })
    expect(notificationValues('stock.low', { kind: 'out', label: 'Mug', qty: 0 }, 'Shop').stock_kind).toBe('Out of stock')
    expect(notificationValues('course.enrolled', { id: 4, courseId: 2, userId: 9, source: 'purchase' }, 'Shop')).toMatchObject({ enrolment_id: '4', course_id: '2', user_id: '9', source: 'purchase' })
    expect(notificationValues('subscription.payment_failed', { id: 3, productName: 'Club', customerEmail: 'c@example.com', status: 'past-due' }, 'Shop')).toMatchObject({ subscription_id: '3', product_name: 'Club', customer_email: 'c@example.com', status: 'past-due' })
    for (const key of ['stock.low', 'course.enrolled', 'subscription.started', 'subscription.cancelled', 'subscription.payment_failed'] as const) expect(MERGE_TAGS[key].length).toBeGreaterThan(2)
  })
  it('emails the customer when a subscription is cancelled', async () => {
    const { d, sent } = deps([rule({ event: 'subscription.cancelled', subject: 'Ended: {{product_name}}', body: '{{status}}' })])
    expect(await runNotifications(d, 'subscription.cancelled', { id: 3, productName: 'Club', customerEmail: 'c@example.com', status: 'cancelled' })).toBe(1)
    expect(sent[0]).toMatchObject({ to: 'c@example.com', subject: 'Ended: Club' })
  })
})
