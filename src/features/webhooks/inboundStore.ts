import type { D1Like } from '@/features/apiKeys'
import type { WebhookEvent } from './events'

/**
 * D1 access for inbound webhook endpoints and their log. Bound statements only; `getDb` resolves the
 * binding per call so tests pass an in-memory D1. The endpoint's signing secret is stored encrypted
 * (see ./secret.ts) and never leaves this file in clear. The log keeps the outcome and a short reason,
 * never the received body.
 */

export type InboundAction = 'content' | 'event'
export type InboundCollection = 'pages' | 'posts' | 'events'
export type InboundStatus = 'draft' | 'published'

export type InboundConfig = {
  name: string
  description: string
  /** What a verified request does: create a content item, or trigger an outgoing webhook event. */
  action: InboundAction
  collection: InboundCollection | null
  /** The payload field (dot path) that becomes the title of the new item. */
  titlePath: string
  status: InboundStatus
  event: WebhookEvent | null
  /** How far the request timestamp may differ from the server clock, in seconds. */
  windowSeconds: number
  enabled: boolean
}

export type InboundRecord = InboundConfig & {
  id: number
  /** The public part of the address (the path segment). Not a secret. */
  token: string
  /** The encrypted signing secret (enc:v1:...). Never returned to the browser. */
  secret: string
  createdAt: string
  updatedAt: string
}

export type ReceiptOutcome =
  'pending' | 'created' | 'triggered' | 'duplicate' | 'rejected' | 'failed'

export type ReceiptRecord = {
  id: number
  endpointId: number
  idempotencyKey: string | null
  outcome: ReceiptOutcome
  reason: string | null
  result: string | null
  createdAt: string
  updatedAt: string
}

export type ClaimResult =
  { claimed: true; id: number } | { claimed: false; existing: ReceiptRecord }

export type InboundStore = {
  list(): Promise<InboundRecord[]>
  findByToken(token: string): Promise<InboundRecord | null>
  findById(id: number): Promise<InboundRecord | null>
  count(): Promise<number>
  insert(config: InboundConfig, token: string, sealedSecret: string, at: string): Promise<number>
  update(id: number, config: InboundConfig, at: string): Promise<void>
  setSecret(id: number, sealedSecret: string, at: string): Promise<void>
  /** Deletes the endpoint and its log. */
  remove(id: number): Promise<void>
  /**
   * Takes the idempotency key for one request. A key that is already claimed (pending, created or
   * triggered) is a duplicate. A key whose earlier attempt failed can be claimed again, so a retry
   * is not refused for a failure the site had.
   */
  claim(endpointId: number, idempotencyKey: string, at: string): Promise<ClaimResult>
  /** Writes the final outcome of a claimed request. */
  finish(
    id: number,
    outcome: Exclude<ReceiptOutcome, 'pending' | 'duplicate'>,
    reason: string | null,
    result: string | null,
    at: string,
  ): Promise<void>
  /** Logs a request that was refused before any key was taken (bad signature, bad body). */
  logRejected(
    endpointId: number,
    idempotencyKey: string | null,
    reason: string,
    at: string,
  ): Promise<void>
  listReceipts(endpointId: number, limit: number): Promise<ReceiptRecord[]>
  pruneReceipts(beforeIso: string): Promise<void>
}

type RawInbound = {
  id: number
  name: string
  description: string
  token: string
  secret: string
  action: string
  collection: string | null
  title_path: string
  status: string
  event: string | null
  window_seconds: number
  enabled: number
  created_at: string
  updated_at: string
}
type RawReceipt = {
  id: number
  endpoint_id: number
  idempotency_key: string | null
  outcome: string
  reason: string | null
  result: string | null
  created_at: string
  updated_at: string
}

const INBOUND_COLUMNS =
  'id, name, description, token, secret, action, collection, title_path, status, event, window_seconds, enabled, created_at, updated_at'
const RECEIPT_COLUMNS =
  'id, endpoint_id, idempotency_key, outcome, reason, result, created_at, updated_at'
const INBOUND = '`eg_webhook_inbound`'
const LOG = '`eg_webhook_inbound_log`'

export function rowToInbound(r: RawInbound): InboundRecord {
  return {
    id: Number(r.id),
    name: r.name,
    description: r.description,
    token: r.token,
    secret: r.secret,
    action: r.action === 'event' ? 'event' : 'content',
    collection: (r.collection as InboundCollection | null) ?? null,
    titlePath: r.title_path,
    status: r.status === 'published' ? 'published' : 'draft',
    event: (r.event as WebhookEvent | null) ?? null,
    windowSeconds: Number(r.window_seconds),
    enabled: Number(r.enabled) === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const toReceipt = (r: RawReceipt): ReceiptRecord => ({
  id: Number(r.id),
  endpointId: Number(r.endpoint_id),
  idempotencyKey: r.idempotency_key,
  outcome: r.outcome as ReceiptOutcome,
  reason: r.reason,
  result: r.result,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export function createD1InboundStore(getDb: () => Promise<D1Like>): InboundStore {
  const all = async <T>(sql: string, ...values: unknown[]): Promise<T[]> => {
    const db = await getDb()
    const result = await db
      .prepare(sql)
      .bind(...values)
      .all<T>()
    return result.results ?? []
  }
  const first = async <T>(sql: string, ...values: unknown[]): Promise<T | null> => {
    const db = await getDb()
    return db
      .prepare(sql)
      .bind(...values)
      .first<T>()
  }
  const exec = async (sql: string, ...values: unknown[]): Promise<number> => {
    const db = await getDb()
    const result = (await db
      .prepare(sql)
      .bind(...values)
      .run()) as { meta?: { changes?: number; last_row_id?: number } }
    return Number(result.meta?.changes ?? 0)
  }

  return {
    async list() {
      const rows = await all<RawInbound>(
        `SELECT ${INBOUND_COLUMNS} FROM ${INBOUND} ORDER BY name COLLATE NOCASE`,
      )
      return rows.map(rowToInbound)
    },
    async findByToken(token) {
      const row = await first<RawInbound>(
        `SELECT ${INBOUND_COLUMNS} FROM ${INBOUND} WHERE token = ?`,
        token,
      )
      return row ? rowToInbound(row) : null
    },
    async findById(id) {
      const row = await first<RawInbound>(
        `SELECT ${INBOUND_COLUMNS} FROM ${INBOUND} WHERE id = ?`,
        id,
      )
      return row ? rowToInbound(row) : null
    },
    async count() {
      const row = await first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${INBOUND}`)
      return row ? Number(row.n) : 0
    },
    async insert(config, token, sealedSecret, at) {
      const db = await getDb()
      const result = (await db
        .prepare(
          `INSERT INTO ${INBOUND} (name, description, token, secret, action, collection, title_path, status, event, window_seconds, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          config.name,
          config.description,
          token,
          sealedSecret,
          config.action,
          config.collection,
          config.titlePath,
          config.status,
          config.event,
          config.windowSeconds,
          config.enabled ? 1 : 0,
          at,
          at,
        )
        .run()) as { meta?: { last_row_id?: number } }
      return Number(result.meta?.last_row_id ?? 0)
    },
    async update(id, config, at) {
      await exec(
        `UPDATE ${INBOUND} SET name = ?, description = ?, action = ?, collection = ?, title_path = ?, status = ?, event = ?, window_seconds = ?, enabled = ?, updated_at = ? WHERE id = ?`,
        config.name,
        config.description,
        config.action,
        config.collection,
        config.titlePath,
        config.status,
        config.event,
        config.windowSeconds,
        config.enabled ? 1 : 0,
        at,
        id,
      )
    },
    async setSecret(id, sealedSecret, at) {
      await exec(
        `UPDATE ${INBOUND} SET secret = ?, updated_at = ? WHERE id = ?`,
        sealedSecret,
        at,
        id,
      )
    },
    async remove(id) {
      await exec(`DELETE FROM ${LOG} WHERE endpoint_id = ?`, id)
      await exec(`DELETE FROM ${INBOUND} WHERE id = ?`, id)
    },
    async claim(endpointId, idempotencyKey, at) {
      const inserted = await exec(
        `INSERT INTO ${LOG} (endpoint_id, idempotency_key, outcome, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?) ON CONFLICT DO NOTHING`,
        endpointId,
        idempotencyKey,
        at,
        at,
      )
      if (inserted === 1) {
        const row = await first<{ id: number }>(
          `SELECT id FROM ${LOG} WHERE endpoint_id = ? AND idempotency_key = ?`,
          endpointId,
          idempotencyKey,
        )
        return { claimed: true, id: Number(row?.id ?? 0) }
      }
      const existing = await first<RawReceipt>(
        `SELECT ${RECEIPT_COLUMNS} FROM ${LOG} WHERE endpoint_id = ? AND idempotency_key = ?`,
        endpointId,
        idempotencyKey,
      )
      if (!existing)
        return {
          claimed: false,
          existing: {
            id: 0,
            endpointId,
            idempotencyKey,
            outcome: 'duplicate',
            reason: null,
            result: null,
            createdAt: at,
            updatedAt: at,
          },
        }
      if (existing.outcome === 'failed') {
        const retaken = await exec(
          `UPDATE ${LOG} SET outcome = 'pending', reason = NULL, updated_at = ? WHERE id = ? AND outcome = 'failed'`,
          at,
          existing.id,
        )
        if (retaken === 1) return { claimed: true, id: Number(existing.id) }
      }
      return { claimed: false, existing: toReceipt(existing) }
    },
    async finish(id, outcome, reason, result, at) {
      await exec(
        `UPDATE ${LOG} SET outcome = ?, reason = ?, result = ?, updated_at = ? WHERE id = ?`,
        outcome,
        reason,
        result,
        at,
        id,
      )
    },
    async logRejected(endpointId, idempotencyKey, reason, at) {
      await exec(
        `INSERT INTO ${LOG} (endpoint_id, idempotency_key, outcome, reason, created_at, updated_at) VALUES (?, ?, 'rejected', ?, ?, ?)`,
        endpointId,
        idempotencyKey,
        reason,
        at,
        at,
      )
    },
    async listReceipts(endpointId, limit) {
      const rows = await all<RawReceipt>(
        `SELECT ${RECEIPT_COLUMNS} FROM ${LOG} WHERE endpoint_id = ? ORDER BY id DESC LIMIT ?`,
        endpointId,
        Math.max(1, Math.min(200, limit)),
      )
      return rows.map(toReceipt)
    },
    async pruneReceipts(beforeIso) {
      await exec(`DELETE FROM ${LOG} WHERE created_at < ?`, beforeIso)
    },
  }
}
