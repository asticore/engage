import { authorizeBlog, blogJson as json } from '@/features/blogBuilder/server'
import { d1FromContext, listQuestionSets, writeQuestionSets } from '@/features/blogBuilder/questionSetStore'
import { removeQuestionSet, saveQuestionSet, type BlogQuestionSet } from '@/features/blogBuilder/questionSets'

export const dynamic = 'force-dynamic'

/**
 * GET   the saved question sets (empty list means the built-in default set is in use).
 * POST  { action: 'save', set: {...} }   add a set or replace the one with the same id
 *       { action: 'delete', id: string } remove one set
 *       { action: 'reset' }              remove every saved set, which brings back the built-in default
 *
 * Anyone who can use Write with AI may read the sets. Only admins change them. Every set is checked by
 * `questionSets.ts` before it reaches the table.
 */
export async function GET(): Promise<Response> {
  const auth = await authorizeBlog()
  if (!auth.context) return auth.response
  try {
    const d1 = await d1FromContext()
    return json({ ok: true, sets: d1 ? await listQuestionSets(d1) : [], canEdit: auth.context.isAdmin })
  } catch {
    return json({ ok: true, sets: [], canEdit: auth.context.isAdmin })
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeBlog()
  if (!auth.context) return auth.response
  if (!auth.context.isAdmin) return json({ ok: false, error: 'Only admins can change the question sets.' }, 403)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  try {
    const d1 = await d1FromContext()
    if (!d1) return json({ ok: false, error: 'The sets could not be saved. Try again.' }, 500)
    const current = await listQuestionSets(d1)
    let next: BlogQuestionSet[]
    if (body?.action === 'save') {
      const saved = saveQuestionSet(current, body.set)
      if (saved.ok === false) return json({ ok: false, error: saved.error }, 400)
      next = saved.value
    } else if (body?.action === 'delete' && typeof body.id === 'string') {
      if (!current.some((set) => set.id === body.id)) return json({ ok: false, error: 'That set is not saved.' }, 404)
      next = removeQuestionSet(current, body.id)
    } else if (body?.action === 'reset') {
      next = []
    } else {
      return json({ ok: false, error: 'That action is not known.' }, 400)
    }
    await writeQuestionSets(d1, next, new Date().toISOString())
    return json({ ok: true, sets: next })
  } catch {
    return json({ ok: false, error: 'The sets could not be saved. Try again.' }, 500)
  }
}
