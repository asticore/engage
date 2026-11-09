'use server'

import { headers } from 'next/headers'

import { resolveD1Binding } from '@/cms/db/connect'
import { createD1CategoryStore } from '@/features/apiKeys/categoryStore'
import { isStaffRoles } from '@/features/apiKeys/core'
import type { D1Like } from '@/features/apiKeys'
import { getSecuritySettings } from '@/features/security/settings'
import { getEngine } from '@/lib/engine'
import { buildMarkdownGuide } from './devguide'
import { siteNameFor } from './guideResponse'
import { createD1EndpointStore } from './store'
import { endpointsForAccount } from './accountEndpoints'

/**
 * The API guide a signed-in customer sees in the members portal: only the endpoints their account
 * can actually call (enabled, their access category is allowed, their role fits, and the category's
 * scopes cover reading the collection). Everything else is left out, so a customer never learns about
 * endpoints that are not theirs. Server-only; the cookie session is the caller.
 */

export type PortalGuide = { ok: boolean; error?: string; markdown?: string; endpoints?: Array<{ name: string; path: string; methods: string[] }> }

export async function myApiGuideAction(): Promise<PortalGuide> {
  const engine = await getEngine()
  const incoming = await headers()
  const { user } = await engine.auth({ headers: incoming }).catch((): { user: null } => ({ user: null }))
  if (!user) return { ok: false, error: 'Sign in to see the API guide.' }
  const doc = user as unknown as { id: number; roles?: string[] }
  const settings = await getSecuritySettings(engine as never)
  const roles = doc.roles ?? []
  if (!settings.apiKeys.enabled || (!isStaffRoles(roles) && !settings.apiKeys.allowCustomers)) return { ok: false, error: 'API access is not available to your account.' }
  const getDb = async () => (await resolveD1Binding()) as unknown as D1Like
  const category = await createD1CategoryStore(getDb).categoryForUser(Number(doc.id))
  const all = await createD1EndpointStore(getDb).list()
  const visible = endpointsForAccount(all, { roles, categoryId: category?.id ?? null, categoryScopes: category?.scopes ?? null })
  const host = incoming.get('x-forwarded-host') ?? incoming.get('host') ?? ''
  const proto = incoming.get('x-forwarded-proto') ?? 'https'
  const markdown = buildMarkdownGuide(visible, { baseUrl: host ? `${proto}://${host}` : '', siteName: await siteNameFor(engine), generatedAt: new Date().toISOString().slice(0, 10) })
  return {
    ok: true,
    markdown,
    endpoints: visible.map((e) => ({
      name: e.name,
      path: `/api/x/${e.version}/${e.slug}`,
      methods: ['GET', ...(e.allowCreate ? ['POST'] : []), ...(e.allowUpdate ? ['PATCH'] : []), ...(e.allowDelete ? ['DELETE'] : [])],
    })),
  }
}
