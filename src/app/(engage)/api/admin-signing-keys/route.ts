import { NextResponse } from 'next/server'

import { createD1SigningKeyStore, rotateSigningKeys, currentSigningKey, RETIRED_KEEP_MS } from '@/features/apiKeys/tokens/signingKeys'
import { defaultTokenD1 } from '@/features/apiKeys/tokens/tables'
import { audit, auditContext } from '@/features/security/auditLog'
import { readSecuritySettingsFromD1 } from '@/features/security/settings'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'

/**
 * Admin only. GET lists the signing keys (id, created, retired; never key material). POST rotates now:
 * a new key signs from then on, the old one stays published until its tokens have expired.
 */
const noStore = { 'Cache-Control': 'no-store' }

async function admin(request: Request): Promise<{ id: number; email: string } | null> {
  const engine = await getEngine()
  const { user } = await engine.auth({ headers: request.headers })
  const u = user as { id?: number | string; email?: string; roles?: string[] } | null
  return u?.roles?.includes('admin') ? { id: Number(u.id), email: String(u.email ?? '') } : null
}

async function view() {
  const store = createD1SigningKeyStore(defaultTokenD1)
  const now = Date.now()
  const rows = await store.list()
  return rows.map((r) => ({
    kid: r.kid,
    createdAt: r.createdAt,
    retiredAt: r.retiredAt,
    status: !r.retiredAt ? 'active' : now - Date.parse(r.retiredAt) <= RETIRED_KEEP_MS ? 'retiring' : 'expired',
  }))
}

export async function GET(request: Request): Promise<Response> {
  if (!(await admin(request))) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  const settings = await readSecuritySettingsFromD1()
  const keys = settings.apiKeys.enabled ? await view().catch((): never[] => []) : []
  return NextResponse.json({ enabled: settings.apiKeys.enabled, jwksPath: '/.well-known/jwks.json', keys }, { headers: noStore })
}

export async function POST(request: Request): Promise<Response> {
  const who = await admin(request)
  if (!who) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStore })
  const settings = await readSecuritySettingsFromD1()
  if (!settings.apiKeys.enabled) return NextResponse.json({ ok: false, error: 'API keys are not switched on.' }, { status: 400, headers: noStore })
  const store = createD1SigningKeyStore(defaultTokenD1)
  const now = Date.now()
  const had = (await store.list()).length > 0
  if (had) await rotateSigningKeys(store, now)
  else await currentSigningKey(store, now)
  await audit({ action: 'signing-key.rotated', actorId: who.id, actorEmail: who.email, collectionSlug: 'api-keys', detail: 'rotated by an admin', ...auditContext(request) }, settings).catch((): void => undefined)
  return NextResponse.json({ ok: true, keys: await view() }, { headers: noStore })
}
