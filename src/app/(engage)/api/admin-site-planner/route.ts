import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { AiError, callAiDetailed } from '@/features/ai/client'
import { readSiteContext } from '@/features/ai/builderContext'
import { estimateTokensFromChars, readUsageSummary, recordUsage } from '@/features/ai/builderUsage'
import { aiKeyAvailability, readAiKey, readBuilderSettings } from '@/features/ai/keys'
import { resolveBuilderModel, type AiProvider } from '@/features/ai/models'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { MAX_PLAN_PAGES, mergeSuggestions, normalisePlan, parsePlanReply, treeOrder, type Plan } from '@/features/sitePlanner/plan'
import { parseQuestions, parseSections, planPrompt, plannerSystem, questionsPrompt, sectionsPrompt, suggestPrompt } from '@/features/sitePlanner/prompts'
import * as store from '@/features/sitePlanner/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const AI_TIMEOUT_MS = 90_000

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can use the site planner.' }, 403) }
  if (!(await getFeatureFlags()).siteplanner) return { response: json({ error: 'Switch Site planner on in Site Settings first.' }, 409) }
  return { context }
}

/** Copies of blocks with every row id removed, so a new page gets its own rows. */
const stripIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripIds)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => key !== 'id').map(([key, v]) => [key, stripIds(v)]))
  return value
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** GET: the saved plans, or one plan with `?id=`, plus whether an AI key is set. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (Number.isInteger(id) && id > 0) {
    const plan = await store.getPlan(d1, id)
    return plan ? json({ plan }) : json({ error: 'Plan not found.' }, 404)
  }
  if (new URL(request.url).searchParams.get('templates') === '1') {
    const found = (await (g.context.engine as unknown as { find(args: Record<string, unknown>): Promise<{ docs: Array<{ id: number | string; name?: string }> }> }).find({ collection: 'page-templates', where: { kind: { equals: 'page' } }, limit: 100, depth: 0, overrideAccess: true })).docs
    return json({ templates: found.map((t) => ({ id: Number(t.id), name: String(t.name ?? `Template ${t.id}`) })) })
  }
  const keys = await aiKeyAvailability()
  return json({ plans: await store.listPlans(d1), aiReady: keys.claude || keys.openai })
}

async function pickProvider(): Promise<AiProvider | null> {
  for (const provider of ['claude', 'openai'] as const) if (await readAiKey(provider).catch((): null => null)) return provider
  return null
}

/**
 * POST /api/admin-site-planner
 *   { action: 'save', id?, name, idea, answers, plan }
 *   { action: 'delete', id }
 *   { action: 'questions', idea }                 AI: follow-up questions
 *   { action: 'generate', idea, answers }         AI: a page tree with a brief per page
 *   { action: 'suggest', idea, plan }             AI: extra pages, merged into the plan (not saved)
 *   { action: 'sections', idea, plan, pageId }    AI: suggested sections for one plan page (not saved)
 *   { action: 'create-pages', id }                creates a draft page for every plan page that has none
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date().toISOString()

  if (body.action === 'save') {
    const id = Number(body.id)
    const plan = normalisePlan(body.plan)
    const savedId = await store.savePlan(d1, Number.isInteger(id) && id > 0 ? id : null, { name: text(body.name, 120) || 'My site plan', idea: text(body.idea, 1500), answers: text(body.answers, 3000), plan }, now)
    return json({ ok: true, id: savedId })
  }
  if (body.action === 'delete') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id < 1) return json({ error: 'Invalid plan.' }, 400)
    await store.deletePlan(d1, id)
    return json({ ok: true })
  }

  if (body.action === 'create-pages') {
    const id = Number(body.id)
    const saved = Number.isInteger(id) && id > 0 ? await store.getPlan(d1, id) : null
    if (!saved) return json({ error: 'Plan not found.' }, 404)
    const engine = g.context.engine as unknown as {
      find(args: Record<string, unknown>): Promise<{ docs: Array<Record<string, unknown>> }>
      create(args: Record<string, unknown>): Promise<{ id: number | string }>
    }
    const plan: Plan = { ...saved.plan, pages: saved.plan.pages.map((p) => ({ ...p })) }
    // The plan's page template: every draft page starts from its sections (fresh ids, so no row is shared between pages).
    let templateBlocks: unknown[] = []
    if (plan.templateId) {
      try {
        const template = (await (engine as unknown as { findByID(args: Record<string, unknown>): Promise<{ blocks?: unknown }> }).findByID({ collection: 'page-templates', id: plan.templateId, depth: 0, overrideAccess: true })) ?? {}
        templateBlocks = Array.isArray(template.blocks) ? template.blocks : []
      } catch {
        templateBlocks = []
      }
    }
    const realId = new Map<string, number>()
    for (const p of plan.pages) if (p.pageId) realId.set(p.id, p.pageId)
    let created = 0
    const failed: string[] = []
    for (const node of treeOrder(plan)) {
      const entry = plan.pages.find((p) => p.id === node.id)
      if (!entry || entry.pageId) continue
      try {
        const parent = entry.parentId ? realId.get(entry.parentId) : undefined
        let slug = entry.slug
        for (let n = 1; n <= 20; n++) {
          const candidate = n === 1 ? entry.slug : `${entry.slug}-${n}`
          const { docs } = await engine.find({ collection: 'pages', where: { slug: { equals: candidate } }, limit: 1, depth: 0, draft: true, overrideAccess: true })
          if (docs.length === 0) {
            slug = candidate
            break
          }
        }
        const doc = await engine.create({ collection: 'pages', data: { title: entry.title, slug, ...(parent ? { parent } : {}), ...(templateBlocks.length ? { blocks: stripIds(templateBlocks) } : {}) }, draft: true, user: g.context.user })
        entry.pageId = Number(doc.id)
        if (entry.status === 'idea' || entry.status === 'briefed') entry.status = 'drafted'
        realId.set(entry.id, entry.pageId)
        created += 1
      } catch {
        failed.push(entry.title)
      }
    }
    await store.savePlan(d1, id, { name: saved.name, idea: saved.idea, answers: saved.answers, plan }, now)
    return json({ ok: true, created, failed, plan })
  }

  if (body.action !== 'questions' && body.action !== 'generate' && body.action !== 'suggest' && body.action !== 'sections') return json({ error: 'Unknown action.' }, 400)
  const idea = text(body.idea, 1500)
  if (body.action !== 'sections' && idea.length < 10) return json({ error: 'Describe the site in a sentence or two first.' }, 400)

  const provider = await pickProvider()
  if (!provider) return json({ error: 'No Claude or OpenAI API key is set in Integrations.' }, 400)
  const settings = await readBuilderSettings()
  const before = await readUsageSummary(settings.capUsd)
  if (before.capReached) return json({ error: `The monthly Build with AI spend cap ($${before.capUsd.toFixed(2)}) has been reached. Raise or clear the cap in Integrations to continue.`, code: 'cap_reached' }, 429)

  const apiKey = (await readAiKey(provider))!
  const model = resolveBuilderModel(provider, settings.models[provider])
  const site = await readSiteContext()
  // A voice written on the plan wins over the Build with AI one.
  const system = plannerSystem(site.siteName ?? '', text(body.brandVoice, 500) || (settings.brandVoice ?? ''))
  const user = g.context.user as { id?: number | string } | null
  const userId = user?.id !== undefined && user?.id !== null ? String(user.id) : null

  const ask = async (prompt: string, maxTokens: number): Promise<string> => {
    try {
      const result = await callAiDetailed({ provider, model, maxTokens, system, messages: [{ role: 'user', content: prompt }] }, { apiKey, timeoutMs: AI_TIMEOUT_MS })
      await recordUsage({
        userId,
        provider,
        model,
        mode: 'planner',
        inputTokens: result.usage?.inputTokens ?? estimateTokensFromChars(system.length + prompt.length),
        outputTokens: result.usage?.outputTokens ?? estimateTokensFromChars(result.text.length),
        ok: true,
        estimated: !result.usage,
      })
      return result.text
    } catch (error) {
      await recordUsage({ userId, provider, model, mode: 'planner', inputTokens: 0, outputTokens: 0, ok: false })
      throw error
    }
  }

  try {
    if (body.action === 'questions') {
      const parsed = parseQuestions(await ask(questionsPrompt(idea), 600))
      return parsed.ok === false ? json({ error: parsed.error }, 502) : json({ ok: true, questions: parsed.questions })
    }
    if (body.action === 'generate') {
      const parsed = parsePlanReply(await ask(planPrompt(idea, text(body.answers, 3000)), 3500))
      return parsed.ok === false ? json({ error: `The plan could not be read: ${parsed.error} Try again.` }, 502) : json({ ok: true, plan: parsed.plan })
    }
    if (body.action === 'sections') {
      const plan = normalisePlan(body.plan)
      const page = plan.pages.find((p) => p.id === text(body.pageId, 20))
      if (!page) return json({ error: 'That page is not in the plan.' }, 400)
      const parsedSections = parseSections(await ask(sectionsPrompt(page, plan, idea), 700))
      return parsedSections.ok === false ? json({ error: `The sections could not be read: ${parsedSections.error} Try again.` }, 502) : json({ ok: true, sections: parsedSections.sections })
    }
    const current = normalisePlan(body.plan)
    if (current.pages.length >= MAX_PLAN_PAGES) return json({ error: 'The plan already has the most pages allowed.' }, 400)
    const parsed = parsePlanReply(await ask(suggestPrompt(current, idea), 2500))
    if (parsed.ok === false) return json({ error: `The suggestions could not be read: ${parsed.error} Try again.` }, 502)
    const merged = mergeSuggestions(current, parsed.plan)
    return json({ ok: true, plan: merged, added: merged.pages.length - current.pages.length })
  } catch (error) {
    const message = error instanceof AiError ? error.message : 'The AI request failed. Try again.'
    return json({ error: message }, 502)
  }
}
