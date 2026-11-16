import { NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { monthStart, readUsageSummary } from '@/features/ai/builderUsage'
import { aiKeyAvailability, readBuilderSettings } from '@/features/ai/keys'
import { cleanSettings, retentionCutoff } from '@/features/chatbot/core'
import * as store from '@/features/chatbot/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { plainParagraph } from '@/features/importContent/lexical'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const context = await getAdminContext()
  if (!context.user) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!context.isAdmin) return { response: json({ error: 'Only an admin can manage the chatbot.' }, 403) }
  if (!(await getFeatureFlags()).chatbot) return { response: json({ error: 'Switch Chatbot on in Site Settings first.' }, 409) }
  return { context }
}

/** GET ?filter=all|handoff|unhelpful: settings, totals, spend and the conversation log. */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.context) return g.response
  const raw = new URL(request.url).searchParams.get('filter')
  const filter = raw === 'handoff' || raw === 'unhelpful' ? raw : 'all'
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const shared = await readBuilderSettings().catch((): null => null)
  const [settings, stats, conversations, usage, keys, faqOn] = await Promise.all([
    store.getSettings(d1),
    store.stats(d1, monthStart(now).iso),
    store.listConversations(d1, filter),
    readUsageSummary(shared?.capUsd ?? 0),
    aiKeyAvailability().catch((): { claude: boolean; openai: boolean } => ({ claude: false, openai: false })),
    getFeatureFlags().then((f) => Boolean(f.faq)),
  ])
  return json({ settings, stats: { ...stats, costUsdMonth: stats.costMicroMonth / 1_000_000 }, conversations, shared: { month: usage.month, estCostUsd: usage.estCostUsd, capUsd: usage.capUsd, capReached: usage.capReached }, aiReady: keys.claude || keys.openai, faqOn })
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** POST { action: 'settings', settings } | { action: 'delete', id } | { action: 'purge' } | { action: 'teach', messageId, question, answer } */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.context) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()

  if (body.action === 'settings') {
    await store.saveSettings(d1, cleanSettings(body.settings as Record<string, unknown>), now.toISOString())
    return json({ ok: true })
  }
  if (body.action === 'delete') {
    const id = Math.floor(Number(body.id))
    if (!Number.isFinite(id) || id < 1) return json({ error: 'Unknown conversation.' }, 400)
    await store.deleteConversation(d1, id)
    return json({ ok: true })
  }
  if (body.action === 'purge') {
    const settings = await store.getSettings(d1)
    const cutoff = retentionCutoff(now, settings.retentionDays)
    if (!cutoff) return json({ error: 'Conversations are kept until erased. Set a number of days first.' }, 400)
    return json({ ok: true, removed: await store.purgeOlderThan(d1, cutoff) })
  }
  if (body.action === 'teach') {
    if (!(await getFeatureFlags()).faq) return json({ error: 'Switch FAQ on in Site Settings so the answer can be saved there.' }, 409)
    const question = text(body.question, 300)
    const answer = text(body.answer, 2000)
    if (!question || !answer) return json({ error: 'Write both the question and the answer.' }, 400)
    const engine = await getEngine()
    const doc = await engine.create({ collection: 'faqs', data: { question, answer: plainParagraph(answer), category: 'Chatbot', order: 0 } as never, overrideAccess: true } as never)
    return json({ ok: true, id: (doc as { id?: number | string }).id ?? null })
  }
  return json({ error: 'Unknown action.' }, 400)
}
