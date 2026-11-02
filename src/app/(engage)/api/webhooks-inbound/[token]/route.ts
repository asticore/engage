import { NextResponse } from 'next/server'

import { withErrorLog } from '@/features/errors/withErrorLog'
import {
  handleInbound,
  IDEMPOTENCY_HEADER,
  MAX_INBOUND_BODY_BYTES,
} from '@/features/webhooks/inbound'
import { SIGNATURE_HEADER } from '@/features/webhooks/core'
import { emitWebhookEvent } from '@/features/webhooks/emit'
import { openSecret } from '@/features/webhooks/secret'
import { createInboundContent, webhookStores } from '@/features/webhooks/runtime'

export const dynamic = 'force-dynamic'

/**
 * POST: an inbound webhook. The token in the address names the endpoint; the signature, the replay
 * window and the idempotency key are checked in handleInbound (src/features/webhooks/inbound.ts).
 * Every answer is JSON with no-store caching, and the body is never echoed back.
 */
async function handleInboundPost(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_INBOUND_BODY_BYTES) {
    return NextResponse.json(
      { error: 'The request body is too large.' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  const rawBody = await request.text()
  const result = await handleInbound(
    {
      store: webhookStores().inbound,
      createContent: createInboundContent,
      dispatchEvent: (event, data) => emitWebhookEvent(event, data),
      openSecret,
    },
    {
      token,
      rawBody,
      signature: request.headers.get(SIGNATURE_HEADER),
      idempotencyKey: request.headers.get(IDEMPOTENCY_HEADER),
    },
  )
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export const POST = withErrorLog(handleInboundPost, 'webhook-inbound')
