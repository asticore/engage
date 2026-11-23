import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { clearTestManifest, toActiveTest } from '@/features/abTesting/manifest'
import { summariseGoal } from '@/features/abTesting/overview'
import { resultsForTest } from '@/features/abTesting/results'
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

/** The outcome of a test so far: who leads on its first goal, how far ahead, and how sure the numbers are. Never throws. */
async function outcomeOf(doc: Rec): Promise<{ winner: string | null; leader: string | null; uplift: number | null; readiness: string; visitors: number } | null> {
  if (doc.status !== 'running' && doc.status !== 'stopped') return null
  try {
    const goals = await resultsForTest(toActiveTest(doc))
    const first = goals[0]
    if (!first) return null
    const s = summariseGoal(first)
    return { winner: s.winner, leader: s.leader, uplift: s.uplift, readiness: s.readiness, visitors: s.visitors }
  } catch {
    return null
  }
}

const idOfRel = (v: unknown): number | null => {
  const n = Number(v && typeof v === 'object' ? (v as Rec).id : v)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * GET ?pageId=: the tests on this page, for the editor panel.
 * GET ?templateId= or ?variantPageId=: the test that uses it as a variant, so the variant editor can link back to the original page.
 */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if ('response' in g) return g.response
  const params = new URL(request.url).searchParams
  const templateId = Number(params.get('templateId'))
  const variantPageId = Number(params.get('variantPageId'))
  if ((Number.isInteger(templateId) && templateId > 0) || (Number.isInteger(variantPageId) && variantPageId > 0)) {
    const all = await g.engine.find({ collection: AB_TESTS_SLUG, limit: 200, depth: 0, sort: '-createdAt', overrideAccess: true } as never)
    for (const d of all.docs as Rec[]) {
      const v = ((d.variants as Rec[] | undefined) ?? []).find((x) => (templateId > 0 && idOfRel(x.template) === templateId) || (variantPageId > 0 && idOfRel(x.page) === variantPageId))
      if (v) return json({ variantOf: { testId: d.id, testName: d.name, label: v.label, status: d.status, pageId: idOfRel(d.page) } })
    }
    return json({ variantOf: null })
  }
  const pageId = Number(params.get('pageId'))
  if (!Number.isInteger(pageId) || pageId <= 0) return json({ error: 'Send the page id.' }, 400)
  const found = await g.engine.find({ collection: AB_TESTS_SLUG, where: { page: { equals: pageId } }, limit: 50, depth: 0, sort: '-createdAt', overrideAccess: true } as never)
  const tests = await Promise.all((found.docs as Rec[]).map(async (d) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    scope: d.scope,
    blockId: d.blockId ?? null,
    outcome: await outcomeOf(d),
    variants: ((d.variants as Rec[] | undefined) ?? []).map((v) => ({ key: v.key, label: v.label, weight: Number(v.weight) || 0, isControl: Boolean(v.isControl), templateId: idOfRel(v.template), pageId: idOfRel(v.page) })),
  })))
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
      if (variants.some((v) => !v.isControl && !(test.scope === 'page' ? v.page : v.template))) return json({ error: 'Every variant needs its content. Edit the variant first.' }, 400)
      if (!((test.goals as Rec[] | undefined) ?? []).length) return json({ error: 'Add a goal first, so the test has something to measure.' }, 400)
    }
    await engine.update({ collection: AB_TESTS_SLUG, id: testId, data: { status: body.action === 'start' ? 'running' : 'stopped' }, overrideAccess: true } as never)
    clearTestManifest()
    return json({ ok: true })
  }

  // Fresh copy without ids: a template or page gets its own ids when inserted.
  const strip = (v: unknown): unknown => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Rec).filter(([k]) => k !== 'id' && k !== '_id').map(([k, x]) => [k, strip(x)])) : v)
  const copyPage = async (page: Rec, title: string): Promise<Rec> => {
    const base = typeof page.slug === 'string' && page.slug ? page.slug : 'page'
    let slug = `${base}-variant`
    for (let n = 2; n < 20; n += 1) {
      const clash = await engine.find({ collection: 'pages', where: { and: [{ slug: { equals: slug } }, { parent: { exists: false } }] }, limit: 1, depth: 0, overrideAccess: true } as never)
      if (clash.docs.length === 0) break
      slug = `${base}-variant-${n}`
    }
    const drop = new Set(['id', '_id', 'createdAt', 'updatedAt', 'slug', 'parent', 'isHomepage', '_status', 'title', 'publishedDate', 'versions'])
    const data = Object.fromEntries(Object.entries(page).filter(([k]) => !drop.has(k)).map(([k, v]) => [k, strip(v)]))
    return (await engine.create({ collection: 'pages', data: { ...data, title, slug, isHomepage: false, _status: 'draft' }, overrideAccess: true } as never)) as Rec
  }
  const LETTERS = ['B', 'C', 'D', 'E']

  if (body.action === 'addVariant') {
    const testId = Number(body.testId)
    if (!Number.isInteger(testId) || testId <= 0) return json({ error: 'Pick a test.' }, 400)
    const test = (await engine.findByID({ collection: AB_TESTS_SLUG, id: testId, depth: 0, overrideAccess: true } as never)) as Rec | null
    if (!test) return json({ error: 'That test no longer exists.' }, 404)
    if (test.status === 'running') return json({ error: 'Stop the test before adding a variant.' }, 409)
    const all = (test.variants as Rec[] | undefined) ?? []
    if (all.length >= 4) return json({ error: 'A test can have up to 4 variants.' }, 400)
    const letter = LETTERS[all.length - 1] ?? String(all.length + 1)
    const source = all.find((v) => !v.isControl)
    let added: Rec
    if (test.scope === 'page') {
      const sourceId = idOfRel(source?.page) ?? idOfRel(test.page)
      const page = sourceId ? ((await engine.findByID({ collection: 'pages', id: sourceId, depth: 0, overrideAccess: true } as never)) as Rec | null) : null
      if (!page) return json({ error: 'The page to copy was not found.' }, 404)
      const copy = await copyPage(page, `${String(test.name)} (variant ${letter})`)
      added = { label: `Variant ${letter}`, weight: 0, isControl: false, page: copy.id }
    } else {
      const sourceId = idOfRel(source?.template)
      const tpl = sourceId ? ((await engine.findByID({ collection: 'page-templates', id: sourceId, depth: 0, overrideAccess: true } as never)) as Rec | null) : null
      if (!tpl) return json({ error: 'The variant to copy was not found.' }, 404)
      const copy = (await engine.create({ collection: 'page-templates', data: { name: `${String(test.name)} (variant ${letter})`, kind: 'section', category: 'other', blocks: strip(tpl.blocks) }, overrideAccess: true } as never)) as Rec
      added = { label: `Variant ${letter}`, weight: 0, isControl: false, template: copy.id }
    }
    // An even split across every arm.
    const next = [...all, added].map((v) => ({ ...v, weight: Math.round((100 / (all.length + 1)) * 100) / 100 }))
    await engine.update({ collection: AB_TESTS_SLUG, id: testId, data: { variants: next }, overrideAccess: true } as never)
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
    const all = (test.variants as Rec[] | undefined) ?? []
    const others = Math.max(1, all.filter((v) => !v.isControl).length)
    const variants = all.map((v) => ({ ...v, weight: v.isControl ? 100 - weightB : Math.round((weightB / others) * 100) / 100 }))
    await engine.update({ collection: AB_TESTS_SLUG, id: testId, data: { variants }, overrideAccess: true } as never)
    clearTestManifest()
    return json({ ok: true })
  }

  if (body.action !== 'create') return json({ error: 'Unknown action.' }, 400)
  const pageId = Number(body.pageId)
  const blockId = typeof body.blockId === 'string' ? body.blockId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
  if (!Number.isInteger(pageId) || pageId <= 0) return json({ error: 'Save the page first.' }, 400)
  const wholePage = body.scope === 'page'
  if (!wholePage && !blockId) return json({ error: 'This section has not been saved yet. Save the page, then try again.' }, 400)
  if (!name) return json({ error: 'Give the test a name.' }, 400)

  const page = (await engine.findByID({ collection: 'pages', id: pageId, depth: 0, overrideAccess: true } as never)) as Rec | null
  const section = wholePage ? {} : ((page?.blocks as Rec[] | undefined) ?? []).find((b) => String(b?.id ?? '') === blockId)
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

  if (wholePage) {
    const copy = await copyPage(page, `${name} (variant B)`)
    const wholeTest = (await engine.create({
      collection: AB_TESTS_SLUG,
      data: { name, status: 'draft', page: pageId, scope: 'page', variants: [{ label: 'Original', weight: 100 - wB, isControl: true }, { label: 'Variant B', weight: wB, isControl: false, page: copy.id }], goals, notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : '' },
      overrideAccess: true,
    } as never)) as Rec
    return json({ ok: true, testId: wholeTest.id, variantPageId: copy.id })
  }
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
