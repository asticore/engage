import { authorizeBlog, blogJson as json } from '@/features/blogBuilder/server'
import { matchMedia, mediaKeywords } from '@/features/blogBuilder/mediaMatch'

export const dynamic = 'force-dynamic'

const GALLERY_READ_LIMIT = 1000

/**
 * GET /api/admin-blog-builder/media?q=<words>
 * Finds pictures already in the gallery that match the words (alt text, caption, file name), so the admin
 * can pick a featured image before anyone uploads one. Reads as the signed-in user, so the media rules apply.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeBlog()
  if (!auth.context) return auth.response
  const query = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 300)
  const keywords = mediaKeywords(query)
  if (keywords.length === 0) return json({ ok: true, matches: [] })
  try {
    const engine = auth.context.engine as unknown as {
      find: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }>
    }
    const result = await engine.find({
      collection: 'media',
      depth: 0,
      limit: GALLERY_READ_LIMIT,
      user: auth.context.user,
    })
    return json({ ok: true, matches: matchMedia(result.docs ?? [], keywords) })
  } catch {
    return json({ ok: false, error: 'The gallery could not be searched. Try again.' }, 500)
  }
}
