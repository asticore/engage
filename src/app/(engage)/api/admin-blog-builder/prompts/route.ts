import { randomUUID } from 'node:crypto'

import { readBuilderSettings } from '@/features/ai/keys'
import { authorizeBlog, blogJson as json } from '@/features/blogBuilder/server'
import { addSavedPrompt, removeSavedPrompt, serializeSavedPrompts, type SavedPrompt } from '@/features/blogBuilder/savedPrompts'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin-blog-builder/prompts
 *   { action: 'save', name: string, brief: {...} }   save a brief as a named prompt (up to 20)
 *   { action: 'delete', id: string }                  remove a saved prompt
 *
 * Anyone who can use Write with AI may save and delete prompts; the list is shared by the site and kept on the
 * Integrations global as JSON. Reads and writes go through the engine, so nothing is trusted from the browser.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeBlog()
  if (!auth.context) return auth.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  const current = (await readBuilderSettings()).savedPrompts

  let next: SavedPrompt[]
  if (body?.action === 'save') {
    const added = addSavedPrompt(current, { name: body.name, brief: body.brief }, randomUUID())
    if (added.ok === false) return json({ ok: false, error: added.error }, 400)
    next = added.value
  } else if (body?.action === 'delete' && typeof body.id === 'string') {
    if (!current.some((prompt) => prompt.id === body.id)) return json({ ok: false, error: 'That prompt is not saved.' }, 404)
    next = removeSavedPrompt(current, body.id)
  } else {
    return json({ ok: false, error: 'That action is not known.' }, 400)
  }

  try {
    const engine = auth.context.engine as unknown as {
      updateGlobal: (args: Record<string, unknown>) => Promise<unknown>
    }
    await engine.updateGlobal({
      slug: 'integrations',
      data: { blogSavedPrompts: serializeSavedPrompts(next) },
      user: auth.context.user,
      overrideAccess: true,
    })
  } catch {
    return json({ ok: false, error: 'The prompts could not be saved. Try again.' }, 500)
  }
  return json({ ok: true, savedPrompts: next })
}
