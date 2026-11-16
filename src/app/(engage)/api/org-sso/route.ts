import { NextResponse } from 'next/server'

import { accountContext } from '@/features/accounts/session'
import { ssoAdminList, ssoAdminPost } from '@/features/orgSso/adminActions'
import { adminRequestRefusal } from '@/features/forms/origin'
import { publicOrigin } from '@/features/google/origin'
import { defaultOrgStore } from '@/features/organizations/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Organisation owners set up single sign-on for their own organisation only. Everything is scoped by the session. */
async function guard(request: Request, orgId: string, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  if (!(await getFeatureFlags()).sso) return { response: json({ error: 'Single sign-on is not switched on for this site.' }, 409) }
  const context = await accountContext()
  const user = context.user as unknown as { id: number | string } | null
  if (!user || !orgId) return { response: json({ error: 'Please sign in again.' }, 401) }
  const member = await defaultOrgStore.getMember(orgId, Number(user.id)).catch((): null => null)
  if (!member || member.role !== 'owner') return { response: json({ error: 'Only an owner of this organisation can manage single sign-on.' }, 403) }
  return { orgId }
}

export async function GET(request: Request): Promise<Response> {
  const orgId = new URL(request.url).searchParams.get('orgId') ?? ''
  const g = await guard(request, orgId, false)
  if (!g.orgId) return g.response
  return json(await ssoAdminList(publicOrigin(request.url), g.orgId))
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const orgId = typeof body?.orgId === 'string' ? body.orgId : new URL(request.url).searchParams.get('orgId') ?? ''
  const g = await guard(request, orgId, true)
  if (!g.orgId) return g.response
  if (!body) return json({ error: 'Invalid request.' }, 400)
  return ssoAdminPost(body, g.orgId)
}
