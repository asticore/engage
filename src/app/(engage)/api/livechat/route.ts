import { NextResponse } from 'next/server'

import { rawD1 } from '@/features/ecommerce/server/db'
import { availability, buildTranscript, cleanEmail, cleanMessage, cleanName, retentionCutoff, staffCutoff } from '@/features/livechat/core'
import { notifyStaff, sendVisitorEmail } from '@/features/livechat/notify'
import * as store from '@/features/livechat/store'
import { authCaptchaRefusal } from '@/features/security/authCaptcha'
import { adminHref } from '@/features/security/adminPath'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getAdminRoot } from '@/features/security/settings'
import { getEngine } from '@/lib/engine'
import { configuredSiteOrigin } from '@/utilities/siteOrigin'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const tokenOf = (v: unknown): string => (typeof v === 'string' && /^[\w-]{16,64}$/.test(v) ? v : '')

type Visible = { id: number; sender: string; name: string; content: string; createdAt: string }
const visible = (rows: store.Message[]): Visible[] => rows.filter((m) => !m.note && m.sender !== 'system').map((m) => ({ id: m.id, sender: m.sender, name: m.sender === 'staff' ? m.name : '', content: m.content, createdAt: m.createdAt }))

/**
 * GET ?token=&after=: whether staff are available, and (with a token) the chat's new messages. The widget polls this
 * every few seconds while the chat is open. Internal notes and system lines are never sent.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).livechat) return json({ error: 'Live chat is not switched on.' }, 404)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const settings = await store.getSettings(d1)
  const online = await store.staffOnline(d1, staffCutoff(now))
  const avail = availability(now, settings, online)
  const url = new URL(request.url)
  const out: Record<string, unknown> = { available: avail.online, welcome: settings.welcome, offlineMessage: settings.offlineMessage }
  const chat = await store.chatByToken(d1, tokenOf(url.searchParams.get('token')))
  if (chat) {
    const after = Math.max(0, Math.floor(Number(url.searchParams.get('after'))) || 0)
    out.chat = { status: chat.status, name: chat.name, hasEmail: Boolean(chat.email) }
    out.messages = visible(await store.messagesAfter(d1, chat.id, after, false))
  }
  return json(out)
}

/**
 * POST { action: 'start', message, name?, email?, botToken?, website? } | { action: 'send', token, message } |
 * { action: 'transcript', token, email? } | { action: 'end', token }. `website` is a honeypot.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).livechat) return json({ error: 'Live chat is not switched on.' }, 404)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const nowIso = now.toISOString()
  const settings = await store.getSettings(d1)
  if (hit(`livechat:${clientKey(request)}`, settings.ratePerHour, Date.now(), 3_600_000).limited) return json({ error: 'You have sent a lot of messages. Please try again in a little while.' }, 429)
  const engine = await getEngine()
  const auth = (await engine.auth({ headers: request.headers }).catch(() => ({ user: null as unknown }))) as { user: { id?: number | string; email?: string; displayName?: string; name?: string } | null }
  const userId = Number(auth.user?.id)
  const signedIn = Number.isFinite(userId) && userId > 0

  if (body.action === 'start') {
    if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true, token: crypto.randomUUID(), status: 'open' })
    const message = cleanMessage(body.message)
    if (!message) return json({ error: 'Please type a message.' }, 400)
    const form = new FormData()
    for (const key of ['cf-turnstile-response', 'g-recaptcha-response']) if (typeof body[key] === 'string') form.set(key, body[key] as string)
    const challenge = await authCaptchaRefusal(engine as never, form, request.headers.get('cf-connecting-ip') ?? undefined, 'chatbot')
    if (challenge) return json({ error: challenge }, 400)
    const name = signedIn ? cleanName(auth.user?.displayName ?? auth.user?.name ?? body.name) : cleanName(body.name)
    const email = signedIn ? cleanEmail(auth.user?.email) || cleanEmail(body.email) : cleanEmail(body.email)
    const online = await store.staffOnline(d1, staffCutoff(now))
    const live = availability(now, settings, online).online
    if (!live && (!name || !email)) return json({ error: 'Please enter your name and email so we can reply.' }, 400)
    const cutoff = retentionCutoff(now, settings.retentionDays)
    if (cutoff) await store.purgeClosedBefore(d1, cutoff).catch((): number => 0)
    const token = crypto.randomUUID()
    const id = await store.createChat(d1, { token, userId: signedIn ? userId : null, name, email, status: live ? 'open' : 'offline' }, nowIso)
    const bot = tokenOf(body.botToken) ? await store.botContext(d1, tokenOf(body.botToken)) : ''
    if (bot) await store.addMessage(d1, { chatId: id, sender: 'system', name: '', content: `Earlier chat with the assistant:\n${bot}`, note: true }, nowIso)
    await store.addMessage(d1, { chatId: id, sender: 'visitor', name, content: message }, nowIso)
    const adminUrl = `${configuredSiteOrigin()}${adminHref('/livechat', await getAdminRoot())}`
    await notifyStaff(d1, { kind: live ? 'chat' : 'offline', name, message, notifyEmail: settings.notifyEmail, push: settings.notifyPush, adminPath: adminUrl })
    return json({ ok: true, token, status: live ? 'open' : 'offline', ...(live ? {} : { message: 'Thanks. We will reply to your email.' }) })
  }

  const chat = await store.chatByToken(d1, tokenOf(body.token))
  if (!chat) return json({ error: 'That chat was not found. Please start a new one.' }, 404)

  if (body.action === 'send') {
    const message = cleanMessage(body.message)
    if (!message) return json({ error: 'Please type a message.' }, 400)
    if (chat.status === 'closed') return json({ error: 'This chat has ended. Please start a new one.', ended: true }, 409)
    const id = await store.addMessage(d1, { chatId: chat.id, sender: 'visitor', name: chat.name, content: message }, nowIso)
    return json({ ok: true, id })
  }
  if (body.action === 'transcript') {
    const to = chat.email || cleanEmail(body.email)
    if (!to) return json({ error: 'Please enter your email address.' }, 400)
    if (hit(`livechat-transcript:${clientKey(request)}`, 3, Date.now(), 3_600_000).limited) return json({ error: 'Too many requests. Try again later.' }, 429)
    const lines = (await store.messagesAfter(d1, chat.id, 0, false)).map((m) => ({ sender: m.sender, name: m.name, content: m.content, at: m.createdAt }))
    const sent = await sendVisitorEmail(to, 'Your chat transcript', buildTranscript('', lines), 'livechat.transcript')
    return sent ? json({ ok: true }) : json({ error: 'The email could not be sent. Please try again later.' }, 502)
  }
  if (body.action === 'end') {
    await store.addMessage(d1, { chatId: chat.id, sender: 'system', name: '', content: 'The visitor ended the chat.', note: true }, nowIso)
    await store.setStatus(d1, chat.id, 'closed', nowIso)
    return json({ ok: true })
  }
  return json({ error: 'Unknown action.' }, 400)
}

