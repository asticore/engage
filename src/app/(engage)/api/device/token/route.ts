import { deviceCodeShape, GRANT_TYPE, hashDeviceCode, pollDecision } from '@/features/agentAccess/device'
import { deviceDb, findByHash, notePoll, takeToken } from '@/features/agentAccess/deviceStore'
import { hit } from '@/features/security/rateLimit'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
const err = (error: string, status = 400, extra: Record<string, unknown> = {}): Response => Response.json({ error, ...extra }, { status, headers })

/** POST /api/device/token { grant_type, device_code }: the polling step of device authorisation. Answers like RFC 8628. */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).agents) return new Response('Not found', { status: 404 })
  const address = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (hit(`device-token:${address}`, 120).limited) return err('slow_down', 429)
  const type = request.headers.get('content-type') ?? ''
  const raw = type.includes('application/json') ? ((await request.json().catch((): null => null)) as Record<string, unknown> | null) : Object.fromEntries(new URLSearchParams(await request.text().catch((): string => '')))
  if (!raw || raw.grant_type !== GRANT_TYPE) return err('unsupported_grant_type')
  if (!deviceCodeShape(raw.device_code)) return err('invalid_grant')

  const d1 = await deviceDb()
  const row = await findByHash(d1, await hashDeviceCode(raw.device_code))
  if (!row) return err('invalid_grant')
  const now = Date.now()
  const decision = pollDecision(row, now)
  if (decision.kind === 'error') {
    if (decision.error === 'slow_down') await notePoll(d1, row.id, now, decision.interval ?? row.interval + 5)
    return err(decision.error, 400, decision.interval ? { interval: decision.interval } : {})
  }
  await notePoll(d1, row.id, now, row.interval)
  const token = await takeToken(d1, row)
  if (!token) return err('invalid_grant')
  return Response.json({ access_token: token, token_type: 'Bearer', scope: row.scope }, { headers })
}
