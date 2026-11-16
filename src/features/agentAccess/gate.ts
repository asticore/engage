import { checkCap, kindOfMethod, logPath } from './core'
import * as store from './store'

/**
 * The agent check that runs after a key has authenticated and passed its scope rules. Returns a refusal
 * Response, or null to carry on. A key with no grant is an ordinary key and is not touched. A key with a grant
 * is refused when the grant is revoked or the feature is off (fail closed), and counted against its daily caps.
 * Every request an agent makes is written to the action log, capped ones too.
 */
export async function gateAgentRequest(args: {
  d1: store.D1
  featureOn: boolean
  keyId: number
  method: string
  slug: string[]
  now: number
}): Promise<Response | null> {
  let grant: Awaited<ReturnType<typeof store.grantForKey>>
  try {
    grant = await store.grantForKey(args.d1, args.keyId)
  } catch {
    return null // the table is not there yet: no agent has ever been created
  }
  if (!grant) return null
  const deny = (status: number, name: string, message: string): Response => Response.json({ errors: [{ name, message }] }, { status })
  if (grant.revokedAt) return deny(403, 'AgentRevoked', 'This agent token has been revoked.')
  if (!args.featureOn) return deny(403, 'AgentAccessOff', 'AI agent access is switched off on this site.')

  const kind = kindOfMethod(args.method)
  const base = { grantId: grant.id, keyId: args.keyId, kind, method: args.method.toUpperCase(), path: logPath(args.slug) }
  const counted = await store.countedToday(args.d1, grant.id, args.now).catch((): { reads: number; writes: number } => ({ reads: 0, writes: 0 }))
  const decision = checkCap(grant, kind, counted)
  if (decision.ok === false) {
    await store.logAction(args.d1, { ...base, outcome: 'capped' }, args.now).catch((): void => undefined)
    return Response.json({ errors: [{ name: 'AgentCapReached', message: decision.reason }] }, { status: 429, headers: { 'Retry-After': '3600' } })
  }
  await store.logAction(args.d1, { ...base, outcome: 'allowed' }, args.now).catch((): void => undefined)
  return null
}
