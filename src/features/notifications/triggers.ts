import type { WebhookEvent } from '@/features/webhooks/events'

/**
 * What can start a notification and which merge tags each trigger offers. One registry: the notification
 * editor lists these, the dispatcher fills them, and the email builder (task 8b) reads the same list for its tag picker.
 * Triggers reuse the site's event names (the same ones webhooks use), so every place that raises an event can notify.
 */

export type NotificationTrigger = Extract<WebhookEvent, 'order.created' | 'order.paid' | 'order.refunded' | 'form.submitted' | 'booking.made' | 'user.registered' | 'content.published'>

export const NOTIFICATION_TRIGGERS: { key: NotificationTrigger; label: string; recipients: ('customer' | 'admin' | 'custom')[] }[] = [
  { key: 'order.created', label: 'Order placed', recipients: ['customer', 'admin', 'custom'] },
  { key: 'order.paid', label: 'Order paid (receipt)', recipients: ['customer', 'admin', 'custom'] },
  { key: 'order.refunded', label: 'Order refunded', recipients: ['admin', 'custom'] },
  { key: 'form.submitted', label: 'Form submitted', recipients: ['admin', 'custom'] },
  { key: 'booking.made', label: 'Booking made', recipients: ['admin', 'custom'] },
  { key: 'user.registered', label: 'New sign-up', recipients: ['admin', 'custom'] },
  { key: 'content.published', label: 'Page or post published', recipients: ['admin', 'custom'] },
]

export type MergeTag = { tag: string; label: string }

const COMMON: MergeTag[] = [
  { tag: 'site_name', label: 'Site name' },
  { tag: 'event', label: 'Event name' },
]

export const MERGE_TAGS: Record<NotificationTrigger, MergeTag[]> = {
  'order.created': [...COMMON, { tag: 'order_id', label: 'Order number' }, { tag: 'amount', label: 'Order total' }, { tag: 'customer_email', label: 'Customer email' }],
  'order.paid': [...COMMON, { tag: 'order_id', label: 'Order number' }, { tag: 'amount', label: 'Order total' }, { tag: 'customer_email', label: 'Customer email' }],
  'order.refunded': [...COMMON, { tag: 'order_id', label: 'Order number' }, { tag: 'amount', label: 'Refund amount' }, { tag: 'reason', label: 'Refund reason' }],
  'form.submitted': [...COMMON, { tag: 'form_title', label: 'Form name' }, { tag: 'submission_id', label: 'Entry number' }, { tag: 'fields', label: 'All answers, one per line' }],
  'booking.made': [...COMMON, { tag: 'booking_id', label: 'Booking number' }, { tag: 'guest_count', label: 'Guests' }, { tag: 'event_id', label: 'Event number' }],
  'user.registered': [...COMMON, { tag: 'user_id', label: 'User number' }],
  'content.published': [...COMMON, { tag: 'title', label: 'Title' }, { tag: 'collection', label: 'Page or post' }, { tag: 'slug', label: 'Slug' }],
}

export const isNotificationTrigger = (value: unknown): value is NotificationTrigger => typeof value === 'string' && NOTIFICATION_TRIGGERS.some((t) => t.key === value)

const text = (value: unknown): string => (value === undefined || value === null ? '' : typeof value === 'object' ? '' : String(value))

/** The values for a trigger's merge tags, taken from the event's data. Only plain values; never a whole document. */
export function notificationValues(event: NotificationTrigger, data: Record<string, unknown>, siteName: string): Record<string, string> {
  const base: Record<string, string> = { site_name: siteName, event: NOTIFICATION_TRIGGERS.find((t) => t.key === event)?.label ?? event }
  switch (event) {
    case 'order.created':
    case 'order.paid':
      return { ...base, order_id: text(data.id), amount: text(data.amount), customer_email: text(data.customerEmail) }
    case 'order.refunded':
      return { ...base, order_id: text(data.orderId), amount: text(data.amount), reason: text(data.reason) }
    case 'form.submitted': {
      const values = data.values && typeof data.values === 'object' ? (data.values as Record<string, unknown>) : {}
      const fields = Object.entries(values).map(([k, v]) => `${k}: ${text(v)}`).join('\n')
      return { ...base, form_title: text(data.formTitle), submission_id: text(data.id), fields }
    }
    case 'booking.made':
      return { ...base, booking_id: text(data.id), guest_count: text(data.guestCount), event_id: text(data.eventId) }
    case 'user.registered':
      return { ...base, user_id: text(data.id) }
    case 'content.published':
      return { ...base, title: text(data.title), collection: text(data.collection), slug: text(data.slug) }
  }
}

/** The customer's address, when the event carries one. */
export const customerAddress = (data: Record<string, unknown>): string => text(data.customerEmail) || text(data.email)
