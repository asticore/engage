import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'

/**
 * Server helpers shared by the blog builder routes. Every route checks access here first: a signed-in user
 * who is an admin or can create posts. Nothing the browser sends is trusted for access.
 */

export const blogJson = (body: unknown, status = 200): Response =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function authorizeBlog() {
  const context = await getAdminContext()
  if (!context.user) return { response: blogJson({ ok: false, error: 'Please sign in again.' }, 401) }
  if (context.isAdmin || context.can('posts', 'create')) return { context }
  return {
    response: blogJson({ ok: false, error: 'You do not have permission to create posts.' }, 403),
  }
}
