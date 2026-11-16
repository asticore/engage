import { AiError, callAiDetailed } from '@/features/ai/client'
import { estimateTokensFromChars, readUsageSummary, recordUsage } from '@/features/ai/builderUsage'
import { aiKeyAvailability, readAiKey, readBuilderSettings } from '@/features/ai/keys'
import { AI_TIMEOUT_MS, estimateCostMicro, resolveBuilderModel, type AiProvider } from '@/features/ai/models'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/features/ecommerce/lib/orderStatus'
import { findSuggestions } from '@/features/search/suggest'
import { getEngine } from '@/lib/engine'

import {
  buildSystemPrompt,
  buildUserPrompt,
  citedIndexes,
  dedupeLinks,
  FAQ_CONFIDENT,
  handoffOf,
  isNoAnswer,
  isPolicyPage,
  looksLikeOrderQuestion,
  money,
  offTopic,
  plainText,
  rank,
  stripCitations,
  tokens,
  blockedHit,
  type ChatbotSettings,
  type ChatReply,
  type Source,
  type VisitorMessage,
} from './core'

/**
 * Answers one visitor question (Task 30a). Order: blocked or off-topic filter, the signed-in customer's own orders when asked
 * and switched on, the FAQ, then other site content. With a Claude or OpenAI key and the spend cap not reached, the model writes the
 * answer from those sources only. Without a key, a confident FAQ match is returned as it is, and anything else hands off.
 */

type Engine = Awaited<ReturnType<typeof getEngine>>
type Doc = Record<string, unknown>

export type AnswerInput = {
  question: string
  history: VisitorMessage[]
  settings: ChatbotSettings
  /** The signed-in customer, when there is one. Order status is only ever answered for this person. */
  user: { id: number; email: string } | null
  engine?: Engine
}

const handoff = (settings: ChatbotSettings, via: ChatReply['via'], answer?: string): ChatReply => ({ via, answer: answer ?? settings.handoffMessage, sources: [], handoff: handoffOf(settings) })

export async function loadFaqSources(engine: Engine): Promise<Source[]> {
  try {
    const { docs } = (await engine.find({ collection: 'faqs', limit: 300, depth: 0, overrideAccess: true, sort: 'order' } as never)) as unknown as { docs: Doc[] }
    return docs
      .filter((d) => typeof d.question === 'string' && d.question)
      .map((d) => ({ kind: 'faq' as const, title: String(d.question), url: '/faq', text: plainText(d.answer, 700) }))
      .filter((s) => s.text)
  } catch {
    return []
  }
}

const KIND: Record<string, Source['kind']> = { Page: 'page', Post: 'post', Product: 'product', Event: 'event' }

/** Pages, posts, products and events whose title or excerpt holds a keyword of the question. Public, published, not password protected. */
export async function loadContentSources(question: string): Promise<Source[]> {
  const words = tokens(question)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
  const found = await Promise.all(words.map((w) => findSuggestions(w, 4).catch((): never[] => [])))
  const seen = new Set<string>()
  const out: Source[] = []
  for (const s of found.flat()) {
    if (seen.has(s.url)) continue
    seen.add(s.url)
    const kind = KIND[s.type] ?? 'page'
    out.push({ kind: isPolicyPage(s.title, s.url) && kind === 'page' ? 'policy' : kind, title: s.title, url: s.url, text: s.excerpt })
  }
  return out
}

/** The signed-in customer's latest orders, as a short text. Never reads anyone else's. */
export async function orderStatusAnswer(engine: Engine, user: { id: number }): Promise<string> {
  const { docs } = (await engine.find({ collection: 'orders', where: { customer: { equals: user.id } }, sort: '-createdAt', limit: 3, depth: 0, overrideAccess: true } as never)) as unknown as { docs: Doc[] }
  if (docs.length === 0) return "I can't find any orders on your account."
  const lines = docs.map((o) => {
    const status = ORDER_STATUS_LABELS[String(o.status) as OrderStatus] ?? String(o.status ?? '')
    const date = typeof o.createdAt === 'string' ? o.createdAt.slice(0, 10) : ''
    const tracking = typeof (o as { trackingNumber?: unknown }).trackingNumber === 'string' && (o as { trackingNumber?: string }).trackingNumber ? `, tracking ${(o as { trackingNumber?: string }).trackingNumber}` : ''
    return `Order ${String(o.orderNumber ?? o.id)} (${date}): ${status}, ${money(Number(o.amount) || 0, String(o.currency ?? 'USD').toUpperCase())}${tracking}`
  })
  return `Here are your latest orders:\n${lines.join('\n')}`
}

async function pickProvider(settings: ChatbotSettings): Promise<AiProvider | null> {
  const order: AiProvider[] = settings.provider === 'claude' ? ['claude'] : settings.provider === 'openai' ? ['openai'] : ['claude', 'openai']
  const keys = await aiKeyAvailability().catch((): null => null)
  if (!keys) return null
  return order.find((p) => keys[p]) ?? null
}

async function siteName(engine: Engine): Promise<string> {
  const g = (await engine.findGlobal({ slug: 'site-settings', depth: 0 }).catch((): null => null)) as Doc | null
  return typeof g?.siteName === 'string' ? g.siteName : ''
}

/** Spend this month on the chatbot alone (for the optional chatbot cap). */
export type Spend = { chatbotMicro: number }

export async function answerQuestion(input: AnswerInput, spend: Spend = { chatbotMicro: 0 }): Promise<ChatReply & { costMicro: number }> {
  const { question, settings } = input
  const done = (r: ChatReply, costMicro = 0) => ({ ...r, costMicro })
  if (blockedHit(question, settings.blockedTopics)) return done(handoff(settings, 'blocked', "Sorry, I can't help with that topic."))
  const engine = input.engine ?? (await getEngine())

  if (settings.orderStatus && looksLikeOrderQuestion(question)) {
    if (!input.user) return done({ via: 'order', answer: 'Please sign in first, then I can look up your orders.', sources: [{ title: 'Sign in', url: '/account' }], handoff: null })
    return done({ via: 'order', answer: await orderStatusAnswer(engine, input.user), sources: [{ title: 'Your orders', url: '/account' }], handoff: null })
  }

  const faqs = await loadFaqSources(engine)
  const faqRanked = rank(question, faqs, 0.25, 4)
  const content = rank(question, await loadContentSources(question).catch((): Source[] => []), 0.25, 4)
  const policy = settings.storeHelp ? content.filter((c) => c.source.kind === 'policy') : []
  const recommend = settings.recommendations ? content.filter((c) => c.source.kind === 'product') : []

  // Sources in answer order: FAQ, then store policy pages, then everything else. Products are only used when recommendations are on.
  const ordered: Source[] = [...faqRanked.map((r) => r.source), ...policy.map((r) => r.source), ...content.filter((c) => !policy.includes(c) && (c.source.kind !== 'product' || recommend.includes(c)) && (c.source.kind !== 'policy' || settings.storeHelp)).map((c) => c.source)].slice(0, 5)

  if (offTopic(question, settings.allowedTopics) && ordered.length === 0) return done(handoff(settings, 'handoff', "I can only help with questions about this site's topics. " + settings.handoffMessage))

  const best = faqRanked[0]
  const provider = settings.useAi && ordered.length > 0 ? await pickProvider(settings) : null
  let capped = false
  if (provider) {
    const shared = await readBuilderSettings().catch((): null => null)
    const usage = await readUsageSummary(shared?.capUsd ?? 0)
    const ownCap = settings.capUsd > 0 && spend.chatbotMicro / 1_000_000 >= settings.capUsd
    capped = usage.capReached || ownCap
  }

  if (provider && !capped) {
    const apiKey = await readAiKey(provider)
    const shared = await readBuilderSettings().catch((): null => null)
    const model = resolveBuilderModel(provider, provider === 'claude' ? 'claude-haiku-4-5' : 'gpt-4o-mini', shared?.models[provider])
    const system = buildSystemPrompt(settings, await siteName(engine))
    const prompt = buildUserPrompt(question, ordered)
    const history = input.history.slice(-4)
    try {
      const result = await callAiDetailed({ provider, model, maxTokens: 350, temperature: 0.2, system, messages: [...history, { role: 'user', content: prompt }] }, { apiKey: apiKey ?? '', timeoutMs: AI_TIMEOUT_MS })
      const inTok = result.usage?.inputTokens ?? estimateTokensFromChars(system.length + prompt.length)
      const outTok = result.usage?.outputTokens ?? estimateTokensFromChars(result.text.length)
      await recordUsage({ userId: input.user ? String(input.user.id) : null, provider, model, mode: 'chatbot', inputTokens: inTok, outputTokens: outTok, ok: true, estimated: !result.usage })
      const cost = estimateCostMicro(provider, model, inTok, outTok)
      if (isNoAnswer(result.text)) return done(handoff(settings, 'handoff'), cost)
      const cited = citedIndexes(result.text, ordered.length)
      const used = (cited.length > 0 ? cited.map((n) => ordered[n - 1]!) : ordered.slice(0, 1)).map((s) => ({ title: s.title, url: s.url }))
      return done({ via: 'ai', answer: stripCitations(result.text), sources: dedupeLinks(used), handoff: null }, cost)
    } catch (error) {
      await recordUsage({ userId: input.user ? String(input.user.id) : null, provider, model, mode: 'chatbot', inputTokens: 0, outputTokens: 0, ok: false })
      if (!(error instanceof AiError)) throw error
      // Fall through to the plain answer below: a provider outage must not leave the visitor with nothing.
    }
  }

  // No key, cap reached or the provider failed: answer straight from the FAQ when the match is strong, else hand off.
  if (best && best.score >= FAQ_CONFIDENT) return done({ via: 'faq', answer: best.source.text, sources: [{ title: best.source.title, url: best.source.url }], handoff: null })
  if (capped && ordered.length > 0) {
    return done({ via: 'capped', answer: `I can't write a full answer right now, but these pages may help. ${settings.handoffMessage}`, sources: dedupeLinks(ordered.slice(0, 3).map((s) => ({ title: s.title, url: s.url }))), handoff: handoffOf(settings) })
  }
  if (!provider && ordered.length > 0) {
    return done({ via: 'content', answer: 'These pages may help:', sources: dedupeLinks(ordered.slice(0, 3).map((s) => ({ title: s.title, url: s.url }))), handoff: null })
  }
  return done(handoff(settings, 'handoff'))
}
