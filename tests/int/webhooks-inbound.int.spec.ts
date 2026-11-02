// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { signatureHeader } from '@/features/webhooks/core'
import {
  contentDataFor,
  handleInbound,
  idempotencyKeyFrom,
  MAX_INBOUND_BODY_BYTES,
  readPath,
  validateInbound,
  type InboundDeps,
} from '@/features/webhooks/inbound'
import type {
  ClaimResult,
  InboundConfig,
  InboundRecord,
  InboundStore,
  ReceiptRecord,
} from '@/features/webhooks/inboundStore'
import { pickEventFields, WEBHOOK_EVENTS } from '@/features/webhooks/events'
import { openSecret, sealSecret } from '@/features/webhooks/secret'

const SECRET = 'whsec_inbound_test_secret'
const NOW = Date.UTC(2026, 10, 2, 12, 0, 0)
const TOKEN = 'wh_in_test_endpoint'

/** An in-memory inbound store with the same claim rules as the D1 one. */
function memoryInbound(endpoint: Partial<InboundRecord> = {}) {
  const records = new Map<string, InboundRecord>()
  const receipts: ReceiptRecord[] = []
  let seq = 0
  const base: InboundRecord = {
    id: 1,
    name: 'Desk',
    description: '',
    token: TOKEN,
    secret: sealSecret(SECRET),
    action: 'content',
    collection: 'pages',
    titlePath: 'title',
    status: 'draft',
    event: null,
    windowSeconds: 300,
    enabled: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...endpoint,
  }
  records.set(TOKEN, base)
  const store: InboundStore = {
    list: async () => [...records.values()],
    findByToken: async (token) => records.get(token) ?? null,
    findById: async (id) => [...records.values()].find((r) => r.id === id) ?? null,
    count: async () => records.size,
    insert: async () => 0,
    update: async () => undefined,
    setSecret: async () => undefined,
    remove: async () => undefined,
    claim: async (endpointId, key, at): Promise<ClaimResult> => {
      const existing = receipts.find((r) => r.endpointId === endpointId && r.idempotencyKey === key)
      if (!existing) {
        const row: ReceiptRecord = {
          id: ++seq,
          endpointId,
          idempotencyKey: key,
          outcome: 'pending',
          reason: null,
          result: null,
          createdAt: at,
          updatedAt: at,
        }
        receipts.push(row)
        return { claimed: true, id: row.id }
      }
      if (existing.outcome === 'failed') {
        existing.outcome = 'pending'
        existing.reason = null
        return { claimed: true, id: existing.id }
      }
      return { claimed: false, existing }
    },
    finish: async (id, outcome, reason, result) => {
      const row = receipts.find((r) => r.id === id)!
      row.outcome = outcome
      row.reason = reason
      row.result = result
    },
    logRejected: async (endpointId, key, reason, at) => {
      receipts.push({
        id: ++seq,
        endpointId,
        idempotencyKey: key,
        outcome: 'rejected',
        reason,
        result: null,
        createdAt: at,
        updatedAt: at,
      })
    },
    listReceipts: async (endpointId) =>
      receipts.filter((r) => r.endpointId === endpointId).reverse(),
    pruneReceipts: async () => undefined,
  }
  return { store, receipts }
}

const payloadOf = (value: unknown) => JSON.stringify(value)

async function signed(body: string, timestamp = Math.floor(NOW / 1000), secret = SECRET) {
  return signatureHeader(secret, timestamp, body)
}

function harness(endpoint: Partial<InboundRecord> = {}, failCreate = false) {
  const { store, receipts } = memoryInbound(endpoint)
  const created: Array<{ collection: string; data: unknown }> = []
  const events: Array<{ event: string; data: Record<string, unknown> }> = []
  let createCalls = 0
  const deps: InboundDeps = {
    store,
    now: () => NOW,
    openSecret,
    createContent: async (collection, data) => {
      createCalls += 1
      if (failCreate && createCalls === 1) throw new Error('db down')
      created.push({ collection, data })
      return 9
    },
    dispatchEvent: async (event, data) => {
      events.push({ event, data })
    },
  }
  const send = async (
    rawBody: string,
    options: { key?: string | null; signature?: string | null } = {},
  ) =>
    handleInbound(deps, {
      token: TOKEN,
      rawBody,
      signature: options.signature === undefined ? await signed(rawBody) : options.signature,
      idempotencyKey: options.key === undefined ? 'req-1' : options.key,
    })
  return { send, receipts, created, events }
}

describe('inbound webhooks', () => {
  beforeAll(() => {
    process.env.ENGAGE_SECRET = 'engage-secret-for-webhook-tests'
  })
  afterAll(() => {
    delete process.env.ENGAGE_SECRET
  })

  it('creates a draft page from a signed request and logs the outcome, not the body', async () => {
    const h = harness()
    const body = payloadOf({ title: 'Spring menu', secret: 'do-not-keep' })
    const result = await h.send(body)
    expect(result).toEqual({ status: 200, body: { status: 'created' } })
    expect(h.created).toEqual([
      { collection: 'pages', data: { title: 'Spring menu', _status: 'draft' } },
    ])
    expect(h.receipts[0]).toMatchObject({
      outcome: 'created',
      result: 'pages',
      idempotencyKey: 'req-1',
    })
    expect(JSON.stringify(h.receipts)).not.toContain('do-not-keep')
  })

  it('refuses a bad signature with 401 and logs why', async () => {
    const h = harness()
    const result = await h.send(payloadOf({ title: 'x' }), {
      signature: await signed(payloadOf({ title: 'y' })),
    })
    expect(result.status).toBe(401)
    expect(h.created).toHaveLength(0)
    expect(h.receipts[0]).toMatchObject({
      outcome: 'rejected',
      reason: 'The signature does not match.',
    })
  })

  it('refuses a request outside the replay window, and says the timestamp was the problem', async () => {
    const h = harness({ windowSeconds: 60 })
    const body = payloadOf({ title: 'Late' })
    const stale = await signed(body, Math.floor(NOW / 1000) - 600)
    const result = await h.send(body, { signature: stale })
    expect(result.status).toBe(401)
    expect(h.receipts[0].reason).toBe('The timestamp is outside the replay window.')
  })

  it('accepts a request inside the replay window', async () => {
    const h = harness({ windowSeconds: 60 })
    const body = payloadOf({ title: 'On time' })
    const result = await h.send(body, {
      signature: await signed(body, Math.floor(NOW / 1000) - 30),
    })
    expect(result.status).toBe(200)
  })

  it('requires an idempotency key', async () => {
    const h = harness()
    const result = await h.send(payloadOf({ title: 'x' }), { key: null })
    expect(result.status).toBe(400)
    expect(h.created).toHaveLength(0)
  })

  it('runs a repeated key once and answers the repeat as a duplicate', async () => {
    const h = harness()
    const body = payloadOf({ title: 'Once' })
    expect((await h.send(body)).body).toEqual({ status: 'created' })
    expect(await h.send(body)).toEqual({ status: 200, body: { status: 'duplicate' } })
    expect(h.created).toHaveLength(1)
  })

  it('lets a failed key be sent again and runs it then', async () => {
    const h = harness({}, true)
    const body = payloadOf({ title: 'Retry me' })
    const first = await h.send(body)
    expect(first.status).toBe(500)
    expect(h.receipts[0].outcome).toBe('failed')
    const second = await h.send(body)
    expect(second).toEqual({ status: 200, body: { status: 'created' } })
    expect(h.created).toHaveLength(1)
  })

  it('answers 422 and logs the reason when the payload has no title', async () => {
    const h = harness()
    const result = await h.send(payloadOf({ headline: 'no title field' }))
    expect(result.status).toBe(422)
    expect(h.receipts[0]).toMatchObject({ outcome: 'failed' })
    expect(h.receipts[0].reason).toMatch(/title/)
  })

  it('answers an unknown or switched-off address with 404 and logs nothing', async () => {
    const { store, receipts } = memoryInbound({ enabled: false })
    const deps: InboundDeps = {
      store,
      now: () => NOW,
      openSecret,
      createContent: async () => 1,
      dispatchEvent: async () => undefined,
    }
    expect(
      await handleInbound(deps, {
        token: TOKEN,
        rawBody: '{}',
        signature: null,
        idempotencyKey: 'k',
      }),
    ).toEqual({ status: 404, body: { error: 'Not found.' } })
    expect(
      await handleInbound(deps, {
        token: 'wh_in_nope',
        rawBody: '{}',
        signature: null,
        idempotencyKey: 'k',
      }),
    ).toEqual({ status: 404, body: { error: 'Not found.' } })
    expect(receipts).toHaveLength(0)
  })

  it('refuses a body over the size limit', async () => {
    const h = harness()
    const big = JSON.stringify({ title: 'x'.repeat(MAX_INBOUND_BODY_BYTES) })
    expect((await h.send(big)).status).toBe(413)
  })

  it('refuses a body that is not a JSON object', async () => {
    const h = harness()
    expect((await h.send('[1,2]')).status).toBe(400)
    expect((await h.send('not json')).status).toBe(400)
  })

  it('an event endpoint triggers the event with only the fields that event allows', async () => {
    const h = harness({
      action: 'event',
      collection: null,
      titlePath: '',
      event: 'content.published',
    })
    const body = payloadOf({
      id: 4,
      collection: 'pages',
      title: 'Live',
      password: 'leak-me',
      slug: 'live',
    })
    const result = await h.send(body)
    expect(result.body).toEqual({ status: 'triggered' })
    expect(h.events).toHaveLength(1)
    expect(h.events[0].event).toBe('content.published')
    expect(JSON.stringify(h.events[0].data)).not.toContain('leak-me')
    expect(h.events[0].data).toMatchObject({ id: 4, title: 'Live', slug: 'live' })
    expect(h.receipts[0]).toMatchObject({ outcome: 'triggered', result: 'content.published' })
  })

  it('a booking can trigger the booking.made event from an inbound request', async () => {
    const h = harness({ action: 'event', collection: null, titlePath: '', event: 'booking.made' })
    expect((await h.send(payloadOf({ id: 3, source: 'import', guestCount: 2 }))).status).toBe(200)
    expect(h.events[0]).toEqual({
      event: 'booking.made',
      data: { id: 3, source: 'import', guestCount: 2 },
    })
  })
})

describe('inbound endpoint rules', () => {
  beforeAll(() => {
    process.env.ENGAGE_SECRET = 'engage-secret-for-webhook-tests'
  })
  afterAll(() => {
    delete process.env.ENGAGE_SECRET
  })

  it('accepts a content endpoint and fills the defaults', () => {
    const result = validateInbound({
      name: ' Desk ',
      action: 'content',
      collection: 'posts',
      titlePath: 'post.headline',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Desk',
        description: '',
        action: 'content',
        collection: 'posts',
        titlePath: 'post.headline',
        status: 'draft',
        event: null,
        windowSeconds: 300,
        enabled: true,
      } satisfies InboundConfig,
    })
  })

  it('refuses a collection, window, status or event that is not on the list', () => {
    expect(
      validateInbound({ name: 'a', action: 'content', collection: 'events', titlePath: 'title' })
        .ok,
    ).toBe(false)
    expect(
      validateInbound({
        name: 'a',
        action: 'content',
        collection: 'pages',
        titlePath: 'title',
        windowSeconds: 9999,
      }).ok,
    ).toBe(false)
    expect(
      validateInbound({
        name: 'a',
        action: 'content',
        collection: 'pages',
        titlePath: 'title',
        status: 'archived',
      }).ok,
    ).toBe(false)
    expect(validateInbound({ name: 'a', action: 'event', event: 'webhook.test' }).ok).toBe(false)
    expect(validateInbound({ name: 'a', action: 'event', event: 'order.paid' }).ok).toBe(true)
  })

  it('refuses a title path that is not a plain dotted name', () => {
    for (const titlePath of ['', 'title]', '__proto__.x', 'a..b', 'one.two.three.four.five.six']) {
      expect(
        validateInbound({ name: 'a', action: 'content', collection: 'pages', titlePath }).ok,
      ).toBe(false)
    }
  })

  it('reads a dotted path and never reads prototype keys', () => {
    expect(readPath({ post: { headline: 'Hi' } }, 'post.headline')).toBe('Hi')
    expect(readPath({}, 'constructor')).toBeUndefined()
    expect(readPath({ a: [1] }, 'a.0')).toBeUndefined()
  })

  it('builds the content data from the title and the status', () => {
    expect(
      contentDataFor({ title: '  Hi  ' }, { titlePath: 'title', status: 'published' }),
    ).toEqual({ ok: true, value: { title: 'Hi', _status: 'published' } })
    expect(contentDataFor({ title: 3 }, { titlePath: 'title', status: 'draft' }).ok).toBe(false)
  })

  it('reads the idempotency key only when it is a short plain token', () => {
    expect(idempotencyKeyFrom(' evt_2026-11-02:01 ')).toBe('evt_2026-11-02:01')
    expect(idempotencyKeyFrom('bad key with spaces')).toBeNull()
    expect(idempotencyKeyFrom('x'.repeat(201))).toBeNull()
    expect(idempotencyKeyFrom(null)).toBeNull()
  })

  it('the events list includes booking.made and it can be sent to subscribers', () => {
    expect(WEBHOOK_EVENTS).toContain('booking.made')
    expect(
      pickEventFields('booking.made', { id: 1, eventId: 2, secret: 'x', createdAt: 'now' }),
    ).toEqual({ id: 1, eventId: 2, createdAt: 'now' })
  })

  it('the signing secret for an endpoint opens again', () => {
    expect(openSecret(sealSecret(SECRET))).toBe(SECRET)
  })
})
