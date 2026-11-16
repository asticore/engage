import { sendEmail } from '@/features/email'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'
import { expiryReminderDue, normaliseCartLifetime, normaliseExpiryReminderDays } from '../lib/cartLifetime'
import { signCartToken } from '../lib/abandonedCart'
import { escapeHtml } from '../lib/invoice'
import { rawD1, runChanges } from './db'

type Engine = { findGlobal: (a: unknown) => Promise<Record<string, unknown> | null> }
type Row = { id: number; email: string; updated_at: string }

/**
 * Emails a signed-out shopper whose cart will be deleted in the last N days of its lifetime (Cart expiry reminder setting, off by default).
 * Same safeguards as the abandoned-cart reminders: only an address the shop already knows, never an unsubscribed one, once per cart,
 * and the claim is taken before sending so overlapping cron runs cannot send twice. English only.
 */
export async function runCartExpiryReminders(engine: Engine, now = new Date()): Promise<{ sent: number }> {
  const extra = await engine.findGlobal({ slug: 'shop-extra-settings', depth: 0, overrideAccess: true }).catch((): null => null)
  const lifetime = normaliseCartLifetime(extra)
  const remindDays = normaliseExpiryReminderDays(extra, lifetime)
  if (remindDays <= 0) return { sent: 0 }
  const secret = process.env.ENGAGE_SECRET
  const baseUrl = configuredSiteOrigin()
  if (!secret || !baseUrl) return { sent: 0 }
  const site = (await engine.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch((): null => null)) as { siteName?: string } | null
  const day = 24 * 3_600_000
  const oldest = new Date(now.getTime() - lifetime * day).toISOString()
  const newest = new Date(now.getTime() - (lifetime - remindDays) * day).toISOString()
  const d1 = await rawD1()
  const rows = (
    await d1
      .prepare(
        `SELECT c.id, c.email, c.updated_at FROM eg_carts c
         WHERE c.email IS NOT NULL AND c.email != '' AND c.customer_id IS NULL AND c.purchased_at IS NULL AND c.recovered_at IS NULL
           AND c.expiry_reminder_at IS NULL AND COALESCE(c.unsubscribed,0) = 0
           AND c.updated_at > ?1 AND c.updated_at <= ?2
           AND EXISTS (SELECT 1 FROM eg_carts_items i WHERE i._parent_id = c.id)
         LIMIT 100`,
      )
      .bind(oldest, newest)
      .all<Row>()
  ).results
  let sent = 0
  for (const row of rows) {
    if (!expiryReminderDue({ updatedAt: row.updated_at, lifetimeDays: lifetime, remindDays, now })) continue
    const known = await d1
      .prepare(
        `SELECT
           (EXISTS (SELECT 1 FROM eg_users u WHERE lower(u.email) = lower(?1))
            OR EXISTS (SELECT 1 FROM eg_orders o WHERE lower(o.customer_email) = lower(?1) AND o.status IN ('processing','on-hold','completed','refunded'))) AS known,
           EXISTS (SELECT 1 FROM eg_carts x WHERE lower(x.email) = lower(?1) AND COALESCE(x.unsubscribed,0) = 1) AS suppressed`,
      )
      .bind(row.email)
      .first<{ known: number; suppressed: number }>()
    if (!known?.known || known.suppressed) continue
    const claimed = await runChanges(d1, `UPDATE eg_carts SET expiry_reminder_at = ?2 WHERE id = ?1 AND expiry_reminder_at IS NULL`, row.id, now.toISOString())
    if (!claimed) continue
    const recover = `${baseUrl}/api/shop-cart-recover?t=${encodeURIComponent(await signCartToken(secret, row.id, 'recover'))}`
    const unsub = `${baseUrl}/api/shop-cart-unsubscribe?t=${encodeURIComponent(await signCartToken(secret, row.id, 'unsub'))}`
    const name = site?.siteName || 'our shop'
    const intro = `The cart you saved at ${name} will be cleared in about ${remindDays} ${remindDays === 1 ? 'day' : 'days'}. Open it now if you still want your items.`
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5"><p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(recover)}">Return to your cart</a></p><p style="font-size:12px;color:#666"><a href="${escapeHtml(unsub)}">Unsubscribe from cart reminders</a></p></div>`
    const text = `${intro}\n\nReturn to your cart: ${recover}\n\nUnsubscribe: ${unsub}`
    const result = await sendEmail({ to: row.email, template: 'cart.expiring', subject: 'Your cart is about to expire', html, text, bulk: true, unsubscribeUrl: unsub })
    if (!result.ok && result.reason !== 'suppressed') await runChanges(d1, `UPDATE eg_carts SET expiry_reminder_at = NULL WHERE id = ?1`, row.id)
    else if (result.ok) sent += 1
  }
  return { sent }
}
