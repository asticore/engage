import { resolveD1Binding } from '@/cms/db/connect'
import type { D1Like } from '@/features/apiKeys'
import type { InboundCollection, InboundStatus } from './inboundStore'
import { createD1InboundStore, type InboundStore } from './inboundStore'
import { createD1WebhookStore, type WebhookStore } from './store'

/**
 * The D1-backed stores and the engine calls the webhooks runtime needs, in one place. Each call
 * resolves the binding again, so a request never holds a connection across requests.
 */

const d1 = async (): Promise<D1Like> => (await resolveD1Binding()) as unknown as D1Like

export function webhookStores(): { store: WebhookStore; inbound: InboundStore } {
  return { store: createD1WebhookStore(d1), inbound: createD1InboundStore(d1) }
}

/** Creates one page or post for an inbound request. Access is overridden: the signature is the check. */
export async function createInboundContent(
  collection: InboundCollection,
  data: { title: string; _status: InboundStatus },
): Promise<unknown> {
  const { getEngine } = await import('@/engine')
  const engine = await getEngine()
  return engine.create({ collection, data, overrideAccess: true } as never)
}
