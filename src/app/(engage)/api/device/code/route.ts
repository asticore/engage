import { cleanClientName, cleanScope, MAX_PENDING, newDeviceCode, newUserCode, hashDeviceCode, DEVICE_TTL_MS, POLL_INTERVAL_S } from '@/features/agentAccess/device'
import { countPending, deviceDb, insertDevice } from '@/features/agentAccess/deviceStore'
import { publicOrigin } from '@/features/google/origin'
import { adminHref } from '@/features/security/adminPath'
import { hit } from '@/features/security/rateLimit'
import { getAdminRoot } from '@/features/security/settings'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }

/** POST /api/device/code { client_name, scope }: starts a device authorisation (RFC 8628). Off unless AI agent access is on. */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).agents) return new Response('Not found', { status: 404 })
  const address = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (hit(`device-code:${address}`, 10).limited) return Response.json({ error: 'slow_down' }, { status: 429, headers })
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const d1 = await deviceDb()
  const now = Date.now()
  // Without a cap here anyone could flood the admin's approval list.
  if ((await countPending(d1, now)) >= MAX_PENDING) return Response.json({ error: 'temporarily_unavailable' }, { status: 503, headers })
  const deviceCode = newDeviceCode()
  const userCode = newUserCode()
  await insertDevice(d1, { deviceHash: await hashDeviceCode(deviceCode), userCode, clientName: cleanClientName(body?.client_name), scope: cleanScope(body?.scope) }, now)
  const base = `${publicOrigin(request.url)}${adminHref('/agent-access', await getAdminRoot())}`
  return Response.json(
    { device_code: deviceCode, user_code: userCode, verification_uri: base, verification_uri_complete: `${base}?code=${userCode}`, expires_in: DEVICE_TTL_MS / 1000, interval: POLL_INTERVAL_S },
    { headers },
  )
}
