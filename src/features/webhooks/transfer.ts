import { MAX_WEBHOOKS, validateWebhook, type WebhookConfig } from './core'

/**
 * Webhook settings export and import. The file holds each webhook's settings only: no signing
 * secret, no delivery log, no ids. Imported webhooks get a new signing secret and arrive switched
 * off, so nothing starts sending until an admin has looked at them. Pure, no database.
 */

export const WEBHOOK_EXPORT_FORMAT = 'engage-webhooks'

export type WebhookExport = { format: typeof WEBHOOK_EXPORT_FORMAT; version: 1; webhooks: WebhookConfig[] }

export function exportWebhooks(hooks: readonly WebhookConfig[]): WebhookExport {
  return {
    format: WEBHOOK_EXPORT_FORMAT,
    version: 1,
    webhooks: hooks.map((h) => ({ name: h.name, description: h.description, url: h.url, events: [...h.events], template: h.template, enabled: h.enabled, ratePerMinute: h.ratePerMinute, auditActions: [...h.auditActions], auditRedact: [...h.auditRedact] })),
  }
}

export type ImportResult = { ok: true; webhooks: WebhookConfig[]; skipped: string[] } | { ok: false; error: string }

/** Reads an export file. Rows that fail validation are skipped and named; the rest are returned switched off. */
export function parseWebhookImport(text: string, room: number = MAX_WEBHOOKS): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const file = data as { format?: unknown; webhooks?: unknown } | null
  if (!file || typeof file !== 'object' || file.format !== WEBHOOK_EXPORT_FORMAT || !Array.isArray(file.webhooks)) return { ok: false, error: 'That is not a webhook export file.' }
  const webhooks: WebhookConfig[] = []
  const skipped: string[] = []
  for (const item of file.webhooks) {
    const checked = validateWebhook(item)
    const label = item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string' ? String((item as { name: string }).name).slice(0, 80) : 'Unnamed'
    if (checked.ok === false) skipped.push(`${label}: ${checked.error}`)
    else if (webhooks.length >= room) skipped.push(`${label}: no room left (limit ${MAX_WEBHOOKS}).`)
    else webhooks.push({ ...checked.value, enabled: false })
  }
  if (webhooks.length === 0) return { ok: false, error: skipped.length ? `Nothing could be imported. ${skipped[0]}` : 'The file has no webhooks.' }
  return { ok: true, webhooks, skipped }
}
