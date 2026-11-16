import { createApiKey, type ApiKeyDeps, type ApiKeyStore, type LiveOwner } from '@/features/apiKeys'
import type { ApiKeySettings } from '@/features/security/settings'

import type { GrantInput } from './core'
import * as store from './store'

/** Makes an agent token: a scoped API key owned by `owner` plus its grant. The plain key is returned once and never stored. */
export async function mintAgentToken(args: {
  owner: LiveOwner
  settings: ApiKeySettings
  keyStore: ApiKeyStore
  d1: store.D1
  input: GrantInput
  scopes: unknown
  expiresInDays: unknown
  nowIso: string
}): Promise<{ ok: true; key: string; keyId: number } | { ok: false; error: string }> {
  const deps: ApiKeyDeps = {
    store: args.keyStore,
    now: () => Date.parse(args.nowIso),
    audit: async () => undefined,
    loadOwner: async () => args.owner,
  }
  const created = await createApiKey(deps, args.owner, { name: `Agent: ${args.input.label}`, scopes: args.scopes, expiresInDays: args.expiresInDays }, args.settings)
  if (created.ok === false) return { ok: false, error: created.error }
  await store.insertGrant(args.d1, { keyId: created.value.row.id, ...args.input, createdBy: args.owner.id }, args.nowIso)
  return { ok: true, key: created.value.key, keyId: created.value.row.id }
}
