import { NextResponse } from 'next/server'
import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { removeSuppression } from '@/features/email/suppressionAdmin'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin-email-suppressions  { email }
 * Removes one address from the suppression list. Admins only: the list decides who
 * gets mail, so a role without the admin panel cannot change it.
 */
export async function DELETE(request: Request): Promise<Response> {
  const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
  try {
    const context = await getAdminContext()
    if (!hasAdminPanelAccess(context.user) || !context.isAdmin) return json({ error: 'Forbidden' }, 403)
    const body = (await request.json().catch((): null => null)) as { email?: unknown } | null
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email)) return json({ error: 'An email address is needed' }, 400)
    const removed = await removeSuppression(email)
    return json({ ok: true, removed })
  } catch (error) {
    console.error('admin-email-suppressions DELETE error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
