import { NextResponse } from 'next/server'

import { cleanHistory, cleanQuestion, retentionCutoff } from '@/features/chatbot/core'
import * as store from '@/features/chatbot/store'
import { answerQuestion } from '@/features/chatbot/service'
import { monthStart } from '@/features/ai/builderUsage'
import { rawD1 } from '@/features/ecommerce/server/db'
import { authCaptchaConfig, authCaptchaRefusal } from '@/features/security/authCaptcha'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** GET: what the widget needs to draw itself. No instructions, no keys, no topic lists. */
export async function GET(): Promise<Response> {
  const flags = await getFeatureFlags()
  if (!flags.chatbot) return json({ error: 'The chatbot is not switched on.' }, 404)
  const d1 = (await rawD1()) as never as store.D1
  const s = await store.getSettings(d1)
  const captcha = await authCaptchaConfig((await getEngine()) as never, 'chatbot')
  return json({ live: Boolean(flags.livechat), sitewide: s.sitewide, position: s.position, name: s.name, avatar: s.avatar, greeting: s.greeting, requireConsent: s.requireConsent, consentText: s.consentText, hours: s.hours, captcha })
}

/**
 * POST { action: 'ask', message, history?, token?, website? } or { action: 'rate', token, messageId, rating: 1 | -1 }.
 * `website` is a honeypot. The token is a random id kept in the visitor's browser; it only groups one visitor's messages.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).chatbot) return json({ error: 'The chatbot is not switched on.' }, 404)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const token = typeof body.token === 'string' && /^[\w-]{16,64}$/.test(body.token) ? body.token : ''

  if (body.action === 'rate') {
    const id = Math.floor(Number(body.messageId))
    const ok = Number.isFinite(id) && id > 0 && (body.rating === 1 || body.rating === -1) ? await store.rateMessage(d1, token, id, body.rating) : false
    return ok ? json({ ok: true }) : json({ error: 'Could not save that.' }, 400)
  }
  if (body.action !== 'ask') return json({ error: 'Unknown action.' }, 400)

  const settings = await store.getSettings(d1)
  if (hit(`chatbot:${clientKey(request)}`, settings.ratePerHour, Date.now(), 3_600_000).limited) return json({ error: 'You have asked a lot of questions. Please try again in a little while.' }, 429)
  if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true, via: 'handoff', answer: settings.handoffMessage, sources: [], handoff: null })
  const question = cleanQuestion(body.message)
  if (question.length < 2) return json({ error: 'Please type a question.' }, 400)

  const engine = await getEngine()
  const form = new FormData()
  for (const key of ['cf-turnstile-response', 'g-recaptcha-response']) if (typeof body[key] === 'string') form.set(key, body[key] as string)
  const challenge = await authCaptchaRefusal(engine as never, form, request.headers.get('cf-connecting-ip') ?? undefined, 'chatbot')
  if (challenge) return json({ error: challenge }, 400)

  const auth = (await engine.auth({ headers: request.headers }).catch(() => ({ user: null as unknown }))) as { user: { id?: number | string; email?: string } | null }
  const userId = Number(auth.user?.id)
  const user = Number.isFinite(userId) && userId > 0 ? { id: userId, email: String(auth.user?.email ?? '') } : null

  const now = new Date()
  const nowIso = now.toISOString()
  const cutoff = retentionCutoff(now, settings.retentionDays)
  if (cutoff && !token) await store.purgeOlderThan(d1, cutoff).catch((): number => 0)

  const conversation = await store.openConversation(d1, token, user?.id ?? null, nowIso)
  const conversationId = conversation.id
  const stats = await store.stats(d1, monthStart(now).iso).catch((): null => null)
  const reply = await answerQuestion({ question, history: cleanHistory(body.history), settings, user, engine }, { chatbotMicro: stats?.costMicroMonth ?? 0 })
  await store.addMessage(d1, { conversationId, role: 'user', content: question }, nowIso)
  const messageId = await store.addMessage(d1, { conversationId, role: 'assistant', content: reply.answer, via: reply.via, sources: reply.sources, costMicro: reply.costMicro }, nowIso)
  return json({ ok: true, via: reply.via, answer: reply.answer, sources: reply.sources, handoff: reply.handoff, messageId, token: conversation.token })
}
