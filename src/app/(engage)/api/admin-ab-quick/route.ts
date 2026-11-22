import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { clearTestManifest } from '@/features/abTesting/manifest'
import { AB_TESTS_SLUG } from '@/features/abTesting/slugs'
import { abTestingEnabled } from '@/features/abTesting/settings'
import { adminRequestRefusal } from '@/features/forms/origin'
import { getEngine } from '@/lib/engine'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
type Engine = Awaited<ReturnType<typeof getEngine>>
type Rec = Record<string, unknown>

async function guard(request: Request, write: boolean): Promise<{ response: Response } | { engine: Engine }> {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const ctx = await getAdminContext()
  if (!ctx.user) return { response: json({ error: 'Unauthorised' }, 401) }
  if (!ctx.isAdmin) return { response: json({ error: 'Only an admin can run A/B tests.' }, 403) }
  const engine = await getEngine()
  if (!(await abTestingEnabled(engine as never))) return { response: json({ error: 'Switch A/B testing on in Site Settings, under Features, first.' }, 409) }
  return { engine }
}

/** GET ?pageId=: the tests on this page, for the editor panel. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if ('response' in g) return g.response
  const pageId = Number(new URL(request.url).searchParams.get('pageId'))
  if (!Number.isInteger(pageId) || pageId <= 0) return json({ error: 'Send the page id.' }, 400)
  const found = await g.engine.find({ collection: AB_TESTS_SLUG, where: { page: { equals: pageId } }, limit: 50, depth: 0, sort: '-createdAt', overrideAccess: true } as never)
  const tests = (found.docs as Rec[]).map((d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    scope: d.scope,
    blockId: d.blockId ?? null,
    variants: ((d.variants as Rec[] | undefined) ?? []).map((v) => ({ key: v.key, label: v.label, weight: Number(v.weight) || 0, isControl: Boolean(v.isControl), templateId: typeof v.template === 'object' && v.template ? (v.template as Rec).id : (v.template ?? null) })),
  }))
  return json({ tests })
}

/**
 * POST { action: 'create', pageId, blockId, name, goal?: { type: 'page-visited', path } | { type: 'element-clicked', selector } }
 *      { action: 'start' | 'stop', testId }
 * `create` copies the section into a new section template (the variant to edit in the editor) and adds a draft test with
 * the original as control. Nothing is split until the test is started.
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if ('response' in g) return g.response
  const body = (await request.json().catch((): null => null)) as Rec | null
  if (!body) return json({ error: 'Send the details.' }, 400)
  const engine = g.engine

  if (body.action === 'start' || body.action === 'stop') {
    const testId = Number(body.testId)
    if (!Number.isInteger(testId) || testId <= 0) return json({ error: 'Pick a test.' }, 400)
    if (body.action === 'start') {
      const test = (await engine.findByID({ collection: AB_TESTS_SLUG, id: testId, depth: 0, overrideAccess: true } as never)) as Rec | null
      const variants = (test?.variants as Rec[] | undefined) ?? []
      if (!test) return json({ error: 'That test no longer exists.' }, 404)
      if (variants.some((v) => !v.isControl && !v.template)) return json({ error: 'Every variant needs its section. Edit the variant first.' }, 400)
      if (!((test.goals as Rec[] | undefined) ?? []).length) return json({ error: 'Add a goal first, so the test has something to measure.' }, 400)
    }
    await engine.update({ collection: AB_TESTS_SLUG, id: testId, data: { status: body.action === 'start' ? 'running' : 'stopped' }, overrideAccess: true } as never)
    clearTestManifest()
    return json({ ok: true })
  }

  if (body.action === 'split') {
    const testId = Number(body.testId)
    const weightB = Math.round(Number(body.weightB))
    if (!Number.isInteger(testId) || testId <= 0) return json({ error: 'Pick a test.' }, 400)
    if (!Number.isFinite(weightB) || weightB < 5 || weightB > 95) return json({ error: 'Send the share for the variant, from 5 to 95.' }, 400)
    const test = (await engine.findByID({ collection: AB_TESTS_SLUG, id: testId, depth: 0, overrideAccess: true } as never)) as Rec | null
    if (!test) return json({ error: 'That test no longer exists.' }, 404)
    if (test.status === 'running') return json({ error: 'Stop the test before changing the split.' }, 409)
    const variants = ((test.variants as Rec[] | undefined) ?? []).map((v) => ({ ...v, weight: v.isControl ? 100 - weightB : weightB }))
    await engine.update({ collection: AB_TESTS_SLUG, id: testId, data: { variants }, overrideAccess: true } as never)
    clearTestManifest()
    return json({ ok: true })
  }

  if (body.action !== 'create') return json({ error: 'Unknown action.' }, 400)
  const pageId = Number(body.pageId)
  const blockId = typeof body.blockId === 'string' ? body.blockId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  if (!Number.isInteger(pageId) || pageId <= 0) return json({ error: 'Save the page first.' }, 400)
  if (!blockId) return json({ error: 'This section has not been saved yet. Save the page, then try again.' }, 400)
  if (!name) return json({ error: 'Give the test a name.' }, 400)

  const page = (await engine.findByID({ collection: 'pages', id: pageId, depth: 0, overrideAccess: true } as never)) as Rec | null
  const section = ((page?.blocks as Rec[] | undefined) ?? []).find((b) => String(b?.id ?? '') === blockId)
  if (!page || !section) return json({ error: 'That section is not in the saved page. Save the page, then try again.' }, 404)

  const goal = (body.goal ?? {}) as Rec
  const goals: Rec[] = []
  if (goal.type === 'page-visited' && typeof goal.path === 'string' && goal.path.startsWith('/')) goals.push({ label: `Visits ${goal.path}`, type: 'page-visited', path: goal.path.slice(0, 200) })
  else if (goal.type === 'element-clicked' && typeof goal.selector === 'string' && goal.selector.trim()) goals.push({ label: `Clicks ${goal.selector.trim().slice(0, 80)}`, type: 'element-clicked', selector: goal.selector.trim().slice(0, 200) })
  else if (goal.type === 'form-submitted') {
    const formId = typeof goal.formId === 'string' || typeof goal.formId === 'number' ? Number(goal.formId) : NaN
    goals.push({ label: Number.isInteger(formId) ? `Submits form ${formId}` : 'Submits a form', type: 'form-submitted', ...(Number.isInteger(formId) ? { form: formId } : {}) })
  } else return json({ error: 'Pick a goal: a page to visit, a button to click, or a form to submit.' }, 400)
  const weightB = Math.round(Number(body.weightB))
  const wB = Number.isFinite(weightB) && weightB >= 5 && weightB <= 95 ? weightB : 50

  // Fresh copy without ids: the template gets its own ids when inserted.
  const strip = (v: unknown): unknown => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Rec).filter(([k]) => k !== 'id' && k !== '_id').map(([k, x]) => [k, strip(x)])) : v)
  const template = (await engine.create({ collection: 'page-templates', data: { name: `${name} (variant B)`, kind: 'section', category: 'other', blocks: [strip(section)] }, overrideAccess: true } as never)) as Rec
  const test = (await engine.create({
    collection: AB_TESTS_SLUG,
    data: {
      name,
      status: 'draft',
      page: pageId,
      scope: 'block',
      blockId,
      variants: [{ label: 'Original', weight: 100 - wB, isControl: true }, { label: 'Variant B', weight: wB, isControl: false, template: template.id }],
      goals,
      notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : '',
    },
    overrideAccess: true,
  } as never)) as Rec
  return json({ ok: true, testId: test.id, templateId: template.id })
}
