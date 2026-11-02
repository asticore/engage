'use server'

import { headers } from 'next/headers'

import { isRetentionChoice, newSigningSecret, RETENTION_CHOICES } from './core'
import { purgeOldLogs } from './delivery'
import {
  DEFAULT_INBOUND_WINDOW,
  INBOUND_COLLECTIONS,
  INBOUND_STATUSES,
  INBOUND_WINDOWS,
  MAX_INBOUND_BODY_BYTES,
  validateInbound,
} from './inbound'
import type { InboundConfig, InboundRecord, ReceiptRecord } from './inboundStore'
import { gate, auditWebhook } from './gate'
import { sealSecret } from './secret'
import { webhookStores } from './runtime'
import { EVENT_LABEL_KEYS, WEBHOOK_EVENTS, type WebhookEvent } from './events'

/**
 * What the inbound part of the webhooks screen calls. Every action runs the same gate as the outgoing
 * webhooks (signed in, the `webhooks` permission, not impersonating) and is audited with the endpoint
 * id, never its secret. The signing secret is returned only when an endpoint is created or rotated.
 */

export type InboundView = {
  id: number
  name: string
  description: string
  action: InboundConfig['action']
  collection: InboundConfig['collection']
  titlePath: string
  status: InboundConfig['status']
  event: WebhookEvent | null
  windowSeconds: number
  enabled: boolean
  /** The full address to give the sender. The token in it is not a secret; the signature is. */
  address: string
  createdAt: string
  updatedAt: string
  last: { outcome: string; reason: string | null; at: string } | null
}

export type ReceiptView = {
  id: number
  idempotencyKey: string | null
  outcome: string
  reason: string | null
  result: string | null
  createdAt: string
}

export type InboundData = {
  endpoints: InboundView[]
  retentionDays: number
  retentionChoices: readonly number[]
  windows: readonly number[]
  collections: readonly string[]
  statuses: readonly string[]
  events: Array<{ event: WebhookEvent; labelKey: string }>
  limits: { maxBodyBytes: number; defaultWindow: number }
  secretsReady: boolean
}

export type InboundResult<T = undefined> = { ok: true; value?: T } | { ok: false; error: string }

const SECRET_SETUP =
  'Set ENGAGE_SECRET for this site before creating an inbound endpoint. Signing secrets are encrypted with it.'

const token = (): string => {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return `wh_in_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

const toView = (record: InboundRecord, host: string, last: ReceiptRecord | null): InboundView => ({
  id: record.id,
  name: record.name,
  description: record.description,
  action: record.action,
  collection: record.collection,
  titlePath: record.titlePath,
  status: record.status,
  event: record.event,
  windowSeconds: record.windowSeconds,
  enabled: record.enabled,
  address: `https://${host}/api/webhooks-inbound/${record.token}`,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  last: last ? { outcome: last.outcome, reason: last.reason, at: last.updatedAt } : null,
})

const hostHeader = async (): Promise<string> => (await headers()).get('host') ?? 'your-site'

const toReceiptView = (r: ReceiptRecord): ReceiptView => ({
  id: r.id,
  idempotencyKey: r.idempotencyKey,
  outcome: r.outcome,
  reason: r.reason,
  result: r.result,
  createdAt: r.createdAt,
})

const summaryOf = (config: InboundConfig): string =>
  config.action === 'content'
    ? `${config.collection}: ${config.titlePath}`
    : `event: ${config.event}`

/** Everything the screen needs for the inbound section. */
export async function loadInboundAction(): Promise<InboundResult<InboundData>> {
  const g = await gate('read')
  if (g.ok === false) return g
  const { store, inbound } = webhookStores()
  const host = await hostHeader()
  const records = await inbound.list()
  const endpoints: InboundView[] = []
  for (const record of records)
    endpoints.push(toView(record, host, (await inbound.listReceipts(record.id, 1))[0] ?? null))
  return {
    ok: true,
    value: {
      endpoints,
      retentionDays: await store.getRetentionDays(),
      retentionChoices: RETENTION_CHOICES,
      windows: INBOUND_WINDOWS,
      collections: INBOUND_COLLECTIONS,
      statuses: INBOUND_STATUSES,
      events: WEBHOOK_EVENTS.map((event) => ({ event, labelKey: EVENT_LABEL_KEYS[event] })),
      limits: { maxBodyBytes: MAX_INBOUND_BODY_BYTES, defaultWindow: DEFAULT_INBOUND_WINDOW },
      secretsReady: Boolean(process.env.ENGAGE_SECRET),
    },
  }
}

/** Creates an endpoint (returns its signing secret once) or updates one (no secret). `id` null means create. */
export async function saveInboundAction(
  id: number | null,
  input: unknown,
): Promise<InboundResult<{ endpoint: InboundView; secret: string | null }>> {
  const g = await gate(id === null ? 'create' : 'update')
  if (g.ok === false) return g
  const { inbound } = webhookStores()
  const checked = validateInbound(input)
  if (checked.ok === false) return { ok: false, error: checked.error }
  const at = new Date().toISOString()
  const host = await hostHeader()
  if (id === null) {
    if (!process.env.ENGAGE_SECRET) return { ok: false, error: SECRET_SETUP }
    if ((await inbound.count()) >= 20)
      return { ok: false, error: 'A site can have at most 20 inbound endpoints.' }
    const secret = newSigningSecret()
    const newId = await inbound.insert(checked.value, token(), sealSecret(secret), at)
    const saved = await inbound.findById(newId)
    if (!saved) return { ok: false, error: 'The endpoint could not be saved.' }
    await auditWebhook(g, 'create', newId, `inbound ${saved.name}: ${summaryOf(saved)}`)
    return { ok: true, value: { endpoint: toView(saved, host, null), secret } }
  }
  if (!(await inbound.findById(id))) return { ok: false, error: 'That endpoint no longer exists.' }
  await inbound.update(id, checked.value, at)
  const saved = await inbound.findById(id)
  if (!saved) return { ok: false, error: 'The endpoint could not be saved.' }
  await auditWebhook(g, 'update', id, `inbound ${saved.name}: ${summaryOf(saved)}`)
  return {
    ok: true,
    value: {
      endpoint: toView(saved, host, (await inbound.listReceipts(id, 1))[0] ?? null),
      secret: null,
    },
  }
}

/** A new signing secret for an endpoint. The old one stops verifying at once. Shown once. */
export async function rotateInboundSecretAction(
  id: number,
): Promise<InboundResult<{ secret: string }>> {
  const g = await gate('update')
  if (g.ok === false) return g
  if (!process.env.ENGAGE_SECRET) return { ok: false, error: SECRET_SETUP }
  const { inbound } = webhookStores()
  if (!(await inbound.findById(id))) return { ok: false, error: 'That endpoint no longer exists.' }
  const secret = newSigningSecret()
  await inbound.setSecret(id, sealSecret(secret), new Date().toISOString())
  await auditWebhook(g, 'update', id, 'inbound signing secret rotated')
  return { ok: true, value: { secret } }
}

export async function setInboundEnabledAction(
  id: number,
  enabled: boolean,
): Promise<InboundResult<InboundView>> {
  const g = await gate('update')
  if (g.ok === false) return g
  const { inbound } = webhookStores()
  const existing = await inbound.findById(id)
  if (!existing) return { ok: false, error: 'That endpoint no longer exists.' }
  const config: InboundConfig = {
    name: existing.name,
    description: existing.description,
    action: existing.action,
    collection: existing.collection,
    titlePath: existing.titlePath,
    status: existing.status,
    event: existing.event,
    windowSeconds: existing.windowSeconds,
    enabled,
  }
  await inbound.update(id, config, new Date().toISOString())
  await auditWebhook(g, 'update', id, enabled ? 'inbound turned on' : 'inbound turned off')
  const saved = await inbound.findById(id)
  return saved
    ? {
        ok: true,
        value: toView(saved, await hostHeader(), (await inbound.listReceipts(id, 1))[0] ?? null),
      }
    : { ok: false, error: 'The endpoint could not be saved.' }
}

export async function deleteInboundAction(id: number): Promise<InboundResult> {
  const g = await gate('delete')
  if (g.ok === false) return g
  const { inbound } = webhookStores()
  const existing = await inbound.findById(id)
  if (!existing) return { ok: false, error: 'That endpoint no longer exists.' }
  await inbound.remove(id)
  await auditWebhook(g, 'delete', id, `inbound ${existing.name}`)
  return { ok: true }
}

/** The log of one endpoint, newest first. Bodies are never kept, so none are shown. */
export async function listInboundReceiptsAction(id: number): Promise<InboundResult<ReceiptView[]>> {
  const g = await gate('read')
  if (g.ok === false) return g
  const { inbound } = webhookStores()
  return { ok: true, value: (await inbound.listReceipts(id, 50)).map(toReceiptView) }
}

/** Saves the log retention. Only one of the listed choices is accepted. */
export async function saveRetentionAction(
  days: number,
): Promise<InboundResult<{ retentionDays: number }>> {
  const g = await gate('update')
  if (g.ok === false) return g
  if (!isRetentionChoice(days)) return { ok: false, error: 'Choose a retention from the list.' }
  await webhookStores().store.setRetentionDays(days, new Date().toISOString())
  await auditWebhook(g, 'update', null, `log retention set to ${days} days`)
  return { ok: true, value: { retentionDays: days } }
}

/** Removes the log entries older than the retention now, instead of waiting for the next cron run. */
export async function purgeLogsNowAction(): Promise<InboundResult<{ days: number }>> {
  const g = await gate('update')
  if (g.ok === false) return g
  const { store, inbound } = webhookStores()
  const result = await purgeOldLogs({
    store,
    inbound,
    retentionDays: () => store.getRetentionDays(),
  })
  await auditWebhook(g, 'delete', null, `log purged to ${result.days} days`)
  return { ok: true, value: { days: result.days } }
}
