import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { ssoAdminList, ssoAdminPost } from '@/features/orgSso/adminActions'
import { adminRequestRefusal } from '@/features/forms/origin'
import { publicOrigin } from '@/features/google/origin'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage single sign-on.' }, 403) }
  if (!(await getFeatureFlags()).sso) return { response: json({ error: 'Switch Single sign-on on in Site Settings first.' }, 409) }
  return { context }
}

export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  return json(await ssoAdminList(publicOrigin(request.url), null))
}

export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  return ssoAdminPost(body, null)
}
