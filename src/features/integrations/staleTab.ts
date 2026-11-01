import type { Engine } from '@/engine'
import { NextResponse } from 'next/server'

import { GOOGLE_CONNECTION_SLUG, INTEGRATIONS_SLUG } from '@/features/google/constants'
import { TRACKING_CONNECTIONS_SLUG } from '@/features/tracking/connect/constants'
import { CONFLICT_MESSAGE, VERSIONS_HEADER, type ConnectionVersions } from './versionHeaders'

/** Server only. The stale-tab helpers for the connection routes (see versionHeaders.ts). */

type Reader = Pick<Engine, 'findGlobal'>

/** The versions the page sent, by global slug. Anything malformed is ignored, which means no check. */
export function expectedVersions(request: Request): Record<string, string> {
  const raw = request.headers.get(VERSIONS_HEADER)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''))
  } catch {
    return {}
  }
}

export async function globalVersion(engine: Reader, slug: string): Promise<string | null> {
  const doc = (await engine.findGlobal({ slug, depth: 0, overrideAccess: true }).catch((): null => null)) as { updatedAt?: unknown } | null
  return typeof doc?.updatedAt === 'string' ? doc.updatedAt : null
}

/** True when the global moved on since the page loaded it. No expectation, or no stored version, never counts as stale. */
export async function isStale(engine: Reader, slug: string, expected: Record<string, string>): Promise<boolean> {
  const want = expected[slug]
  if (!want) return false
  const current = await globalVersion(engine, slug)
  return current !== null && current !== want
}

/** The current versions of the three globals these screens touch. Sent back after each answer so the next save is not a conflict with this one. */
export async function currentVersions(engine: Reader): Promise<ConnectionVersions> {
  const slugs = [TRACKING_CONNECTIONS_SLUG, GOOGLE_CONNECTION_SLUG, INTEGRATIONS_SLUG]
  const values = await Promise.all(slugs.map((slug) => globalVersion(engine, slug)))
  return Object.fromEntries(slugs.map((slug, index) => [slug, values[index]]))
}

/** The 409 answer for a refused save. `error` and `message` both carry the sentence, so each screen reads it. */
export function conflictResponse(headers: Record<string, string> = { 'Cache-Control': 'no-store' }): Response {
  return NextResponse.json({ ok: false, reason: 'conflict', error: CONFLICT_MESSAGE, message: CONFLICT_MESSAGE }, { status: 409, headers })
}
