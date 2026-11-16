import { describeForm, authoriseKey } from '@/features/forms/dataApi'
import { FORMS_SLUG } from '@/features/forms/slugs'
import type { FormDoc } from '@/features/forms/types'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'

/** GET /api/forms/:id - the form's field definitions, for an API key with the forms:read scope (see dataApi.ts). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const engine = await getEngine()
    const auth = await authoriseKey(engine as never, request, 'forms')
    if (!auth.ok) return auth.response
    const { id } = await context.params
    if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'Form not found.' }, { status: 404 })
    const form = (await engine.findByID({ collection: FORMS_SLUG, id: Number(id), depth: 0, overrideAccess: true }).catch((): null => null)) as FormDoc | null
    if (!form) return Response.json({ error: 'Form not found.' }, { status: 404 })
    return Response.json(describeForm(form), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('forms GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
