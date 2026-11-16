import { buildRobotsTxt } from '@/features/seo'
import { isStaging } from '@/features/site/staging'
import { getAdminRoot } from '@/features/security/settings'

// Settings are read from the database on every request, so this can never be
// prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * A route handler rather than Next's `robots.ts` convention: the settings let
 * an editor supply a complete replacement file, and the structured form that
 * convention returns cannot represent arbitrary directives.
 */
export async function GET(): Promise<Response> {
  if (isStaging()) return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
  const body = await buildRobotsTxt(await getAdminRoot())

  if (body === null) {
    return new Response('Not found', { status: 404 })
  }

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
