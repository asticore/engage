import { verifySignature, type ValidationResult } from './core'
import { isWebhookEvent, pickEventFields, type WebhookEvent } from './events'
import type {
  ClaimResult,
  InboundCollection,
  InboundConfig,
  InboundStatus,
  InboundStore,
} from './inboundStore'

/**
 * Inbound webhooks: another service posts a signed JSON request to an address the site gives each
 * endpoint, and the site either creates a content item from it or triggers an outgoing webhook event
 * (so the webhooks already subscribed to that event receive it). The rules and the handler live here;
 * the public route (src/app/(engage)/api/webhooks-inbound/[token]/route.ts) only reads the request and
 * writes the answer.
 *
 * Request rules, in order:
 *  1. Unknown or switched-off endpoint: 404, nothing logged (the address is public, so no hint is given).
 *  2. Body over MAX_INBOUND_BODY_BYTES: 413.
 *  3. X-Engage-Signature must be t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>"> with the endpoint's
 *     secret, and t must be within the endpoint's replay window: 401 otherwise.
 *  4. Idempotency-Key header is required (letters, digits, dot, colon, dash, underscore; up to 200).
 *     A key already used by a request that was created or triggered is answered 200 as a duplicate and
 *     nothing runs again. A key whose earlier try failed may be sent again.
 *  5. The body must be a JSON object; a content endpoint needs its title field; an event endpoint
 *     sends only the fields that event allows (see EVENT_FIELDS).
 *
 * Every request that gets past the endpoint lookup is written to the log (outcome and reason, never
 * the body).
 */

export const MAX_INBOUND_BODY_BYTES = 65_536
export const INBOUND_WINDOWS = [60, 300, 900] as const
export const DEFAULT_INBOUND_WINDOW = 300
export const INBOUND_COLLECTIONS: readonly InboundCollection[] = ['pages', 'posts']
export const INBOUND_STATUSES: readonly InboundStatus[] = ['draft', 'published']
const MAX_NAME = 80
const MAX_DESCRIPTION = 300
const MAX_TITLE = 200
const TITLE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*){0,4}$/
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{1,200}$/
const UNSAFE_PATH_PARTS = new Set(['__proto__', 'constructor', 'prototype'])

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

/** Checks an admin's form input for one inbound endpoint. The signing secret is not part of it. */
export function validateInbound(input: unknown): ValidationResult<InboundConfig> {
  if (!input || typeof input !== 'object')
    return { ok: false, error: 'The endpoint is missing its details.' }
  const raw = input as Record<string, unknown>
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name || name.length > MAX_NAME)
    return { ok: false, error: `Give the endpoint a name of ${MAX_NAME} characters or fewer.` }
  const description =
    typeof raw.description === 'string' ? raw.description.trim().slice(0, MAX_DESCRIPTION) : ''

  const windowSeconds =
    raw.windowSeconds === undefined || raw.windowSeconds === null || raw.windowSeconds === ''
      ? DEFAULT_INBOUND_WINDOW
      : Number(raw.windowSeconds)
  if (!(INBOUND_WINDOWS as readonly number[]).includes(windowSeconds))
    return { ok: false, error: 'Choose a replay window from the list.' }

  if (raw.action !== 'content' && raw.action !== 'event')
    return { ok: false, error: 'Choose what the endpoint does.' }

  let collection: InboundCollection | null = null
  let titlePath = ''
  let status: InboundStatus = 'draft'
  let event: WebhookEvent | null = null

  if (raw.action === 'content') {
    if (!INBOUND_COLLECTIONS.includes(raw.collection as InboundCollection))
      return { ok: false, error: 'Choose which kind of content the endpoint creates.' }
    collection = raw.collection as InboundCollection
    const unsafe =
      typeof raw.titlePath === 'string' &&
      raw.titlePath.split('.').some((part) => UNSAFE_PATH_PARTS.has(part))
    if (typeof raw.titlePath !== 'string' || unsafe || !TITLE_PATH.test(raw.titlePath.trim())) {
      return {
        ok: false,
        error:
          'Enter the payload field that holds the title, such as title or post.headline (letters, digits and dots).',
      }
    }
    titlePath = raw.titlePath.trim()
    if (raw.status !== undefined && !INBOUND_STATUSES.includes(raw.status as InboundStatus))
      return { ok: false, error: 'Choose draft or published.' }
    status = (raw.status as InboundStatus | undefined) ?? 'draft'
  } else {
    if (!isWebhookEvent(raw.event)) return { ok: false, error: 'Choose the event to trigger.' }
    event = raw.event
  }

  return {
    ok: true,
    value: {
      name,
      description,
      action: raw.action,
      collection,
      titlePath,
      status,
      event,
      windowSeconds,
      enabled: raw.enabled !== false,
    },
  }
}

/** Reads a dot path from a payload. Only plain own properties count; a missing or non-text value is undefined. */
export function readPath(payload: Record<string, unknown>, path: string): unknown {
  let current: unknown = payload
  for (const part of path.split('.')) {
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return undefined
    if (
      !current ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      !Object.prototype.hasOwnProperty.call(current, part)
    )
      return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** The data for a new content item: the title from the mapped field, and the status the endpoint sets. */
export function contentDataFor(
  payload: Record<string, unknown>,
  config: Pick<InboundConfig, 'titlePath' | 'status'>,
): ValidationResult<{ title: string; _status: InboundStatus }> {
  const raw = readPath(payload, config.titlePath)
  if (typeof raw !== 'string' || raw.trim() === '')
    return { ok: false, error: `The payload has no text at "${config.titlePath}" for the title.` }
  return { ok: true, value: { title: raw.trim().slice(0, MAX_TITLE), _status: config.status } }
}

/** The idempotency key: a valid header value, or null when it is missing or not allowed. */
export function idempotencyKeyFrom(header: string | null): string | null {
  if (header === null) return null
  const value = header.trim()
  return IDEMPOTENCY_KEY.test(value) ? value : null
}

export type InboundDeps = {
  store: InboundStore
  /** Creates one content item. Returns its id, or throws. */
  createContent: (
    collection: InboundCollection,
    data: { title: string; _status: InboundStatus },
  ) => Promise<unknown>
  /** Sends an outgoing webhook event to the subscribed webhooks. Never throws. */
  dispatchEvent: (event: WebhookEvent, data: Record<string, unknown>) => Promise<void>
  openSecret: (sealed: string) => string
  now?: () => number
}

export type InboundRequest = {
  token: string
  rawBody: string
  signature: string | null
  idempotencyKey: string | null
}
export type InboundResponse = { status: number; body: Record<string, unknown> }

const reply = (status: number, body: Record<string, unknown>): InboundResponse => ({ status, body })

/** The timestamp inside a signature header, or null when the header is malformed. */
const timestampOf = (header: string | null): number | null => {
  const match = /^t=(\d+),v1=[0-9a-f]{64}$/.exec((header ?? '').trim())
  return match ? Number(match[1]) : null
}

/** Handles one inbound request. Never throws; every failure is an answer with a status. */
export async function handleInbound(
  deps: InboundDeps,
  request: InboundRequest,
): Promise<InboundResponse> {
  const { store } = deps
  const nowMs = deps.now ? deps.now() : Date.now()
  const at = new Date(nowMs).toISOString()
  try {
    const endpoint = await store.findByToken(request.token)
    if (!endpoint || !endpoint.enabled) return reply(404, { error: 'Not found.' })

    const reject = async (
      status: number,
      message: string,
      reason: string,
      key: string | null = null,
    ): Promise<InboundResponse> => {
      await store.logRejected(endpoint.id, key, reason, at)
      return reply(status, { error: message })
    }

    if (new TextEncoder().encode(request.rawBody).length > MAX_INBOUND_BODY_BYTES)
      return reject(413, 'The request body is too large.', 'The body is over the size limit.')

    const secret = deps.openSecret(endpoint.secret)
    if (!secret)
      return reject(
        500,
        'The signing secret cannot be read. The site owner must rotate it.',
        'The signing secret cannot be read.',
      )

    const timestamp = timestampOf(request.signature)
    const nowSeconds = Math.floor(nowMs / 1000)
    const valid = await verifySignature(
      secret,
      request.signature ?? '',
      request.rawBody,
      nowSeconds,
      endpoint.windowSeconds,
    )
    if (!valid) {
      const stale = timestamp !== null && Math.abs(nowSeconds - timestamp) > endpoint.windowSeconds
      return reject(
        401,
        'The signature check failed.',
        stale ? 'The timestamp is outside the replay window.' : 'The signature does not match.',
      )
    }

    const key = idempotencyKeyFrom(request.idempotencyKey)
    if (key === null)
      return reject(
        400,
        `Send an ${IDEMPOTENCY_HEADER} header of up to 200 letters, digits, dots, colons, dashes or underscores.`,
        'The idempotency key is missing or not allowed.',
      )

    let payload: unknown
    try {
      payload = JSON.parse(request.rawBody)
    } catch {
      return reject(400, 'The body must be JSON.', 'The body is not JSON.', key)
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return reject(400, 'The body must be a JSON object.', 'The body is not a JSON object.', key)
    const fields = payload as Record<string, unknown>

    const claim: ClaimResult = await store.claim(endpoint.id, key, at)
    if (!claim.claimed) return reply(200, { status: 'duplicate' })

    if (endpoint.action === 'content') {
      const data = contentDataFor(fields, endpoint)
      if (data.ok === false) {
        await store.finish(claim.id, 'failed', data.error, null, at)
        return reply(422, { error: data.error })
      }
      try {
        await deps.createContent(endpoint.collection as InboundCollection, data.value)
      } catch {
        await store.finish(claim.id, 'failed', 'The content item could not be created.', null, at)
        return reply(500, {
          error: 'The content item could not be created. Send the same request again to retry.',
        })
      }
      await store.finish(claim.id, 'created', null, endpoint.collection, at)
      return reply(200, { status: 'created' })
    }

    const event = endpoint.event as WebhookEvent
    await deps.dispatchEvent(event, pickEventFields(event, fields))
    await store.finish(claim.id, 'triggered', null, event, at)
    return reply(200, { status: 'triggered' })
  } catch {
    return reply(500, { error: 'The request could not be processed.' })
  }
}
