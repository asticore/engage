import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { buildTranscript, cleanCanned, cleanMessage, cleanSettings, CHAT_STATUSES, fillCanned, MAX_CANNED, retentionCutoff, staffCutoff } from '@/features/livechat/core'
import { sendVisitorEmail } from '@/features/livechat/notify'
import * as store from '@/features/livechat/store'
import { listPeople } from '@/features/taskboard/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard(request: Request, write: boolean) {
  if (write) {
    const refusal = adminRequestRefusal(request)
    if (refusal) return { response: json({ error: refusal }, 403) }
  }
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return { response: json({ error: 'Please sign in again.' }, 401) }
  if (!(await getFeatureFlags()).livechat) return { response: json({ error: 'Switch Live chat on in Site Settings first.' }, 409) }
  const user = ctx.user as { id: number | string; email?: string; displayName?: string }
  return { ctx, me: { id: Number(user.id), isAdmin: ctx.isAdmin, label: user.displayName || user.email || 'Support' } }
}

const id = (v: unknown): number => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * GET ?filter=active|mine|unassigned|offline|closed&chat=ID&after=ID: the inbox, counts, canned replies, and with `chat` that chat's
 * messages (internal notes included). Every call counts as the staff member being online; the inbox calls it every few seconds.
 */
export async function GET(request: Request): Promise<Response> {
  const g = await guard(request, false)
  if (!g.ctx) return g.response
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  await store.heartbeat(d1, g.me.id, g.me.label, now.toISOString())
  const url = new URL(request.url)
  const raw = url.searchParams.get('filter')
  const filter = raw === 'mine' || raw === 'unassigned' || raw === 'offline' || raw === 'closed' ? raw : 'active'
  const settings = await store.getSettings(d1)
  if (settings.autoCloseHours > 0) await store.closeIdle(d1, new Date(now.getTime() - settings.autoCloseHours * 3_600_000).toISOString(), now.toISOString()).catch((): number => 0)
  const out: Record<string, unknown> = {
    inbox: await store.listInbox(d1, filter, g.me.id),
    counts: await store.inboxCounts(d1),
    canned: await store.listCanned(d1),
    people: await listPeople(d1 as never).catch((): never[] => []),
    online: await store.staffOnline(d1, staffCutoff(now)),
    me: { id: g.me.id, isAdmin: g.me.isAdmin },
    ...(g.me.isAdmin ? { settings } : {}),
  }
  const chatId = id(url.searchParams.get('chat'))
  if (chatId) {
    const chat = await store.getChat(d1, chatId)
    if (chat) {
      out.chat = chat
      out.messages = await store.messagesAfter(d1, chatId, Math.max(0, Math.floor(Number(url.searchParams.get('after'))) || 0), true)
      await store.markSeen(d1, chatId)
    }
  }
  return json(out)
}

/**
 * POST { action: 'reply' | 'note', chat, content } | { action: 'assign', chat, to } | { action: 'status', chat, status } |
 * { action: 'transcript', chat } | { action: 'delete', chat } (admin) | { action: 'canned', id?, title, body } (admin) |
 * { action: 'canned-delete', id } (admin) | { action: 'settings', settings } (admin) | { action: 'purge' } (admin)
 */
export async function POST(request: Request): Promise<Response> {
  const g = await guard(request, true)
  if (!g.ctx) return g.response
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const now = new Date()
  const nowIso = now.toISOString()
  const adminOnly = (): Response | null => (g.me.isAdmin ? null : json({ error: 'Only an admin can do that.' }, 403))

  switch (body.action) {
    case 'reply':
    case 'note': {
      const chat = await store.getChat(d1, id(body.chat))
      if (!chat) return json({ error: 'Chat not found.' }, 404)
      const content = cleanMessage(fillCanned(typeof body.content === 'string' ? body.content : '', chat.name))
      if (!content) return json({ error: 'Write a message first.' }, 400)
      const isNote = body.action === 'note'
      const messageId = await store.addMessage(d1, { chatId: chat.id, sender: 'staff', staffId: g.me.id, name: g.me.label, content, note: isNote }, nowIso)
      if (!isNote) {
        if (chat.assignedTo == null) await store.assign(d1, chat.id, g.me.id, nowIso)
        if (chat.status === 'closed') await store.setStatus(d1, chat.id, chat.email ? 'offline' : 'open', nowIso)
        // An offline chat has no one watching the page, so the reply goes by email.
        if (chat.status === 'offline' && chat.email) await sendVisitorEmail(chat.email, 'Reply to your message', `${content}\n\n(You can reply to this email.)`, 'livechat.reply')
      }
      return json({ ok: true, id: messageId })
    }
    case 'assign': {
      const chatId = id(body.chat)
      const to = body.to === null || body.to === '' ? null : id(body.to) || null
      if (!(await store.getChat(d1, chatId))) return json({ error: 'Chat not found.' }, 404)
      await store.assign(d1, chatId, to, nowIso)
      return json({ ok: true })
    }
    case 'status': {
      const chatId = id(body.chat)
      const status = body.status
      if (!CHAT_STATUSES.includes(status as never) || !(await store.getChat(d1, chatId))) return json({ error: 'Chat not found.' }, 404)
      await store.setStatus(d1, chatId, status as 'open' | 'closed' | 'offline', nowIso)
      return json({ ok: true })
    }
    case 'transcript': {
      const chat = await store.getChat(d1, id(body.chat))
      if (!chat) return json({ error: 'Chat not found.' }, 404)
      if (!chat.email) return json({ error: 'This visitor did not give an email address.' }, 400)
      const lines = (await store.messagesAfter(d1, chat.id, 0, false)).map((m) => ({ sender: m.sender, name: m.name, content: m.content, at: m.createdAt }))
      const sent = await sendVisitorEmail(chat.email, 'Your chat transcript', buildTranscript('', lines), 'livechat.transcript')
      return sent ? json({ ok: true }) : json({ error: 'The email could not be sent.' }, 502)
    }
    case 'delete': {
      const denied = adminOnly()
      if (denied) return denied
      await store.deleteChat(d1, id(body.chat))
      return json({ ok: true })
    }
    case 'canned': {
      const denied = adminOnly()
      if (denied) return denied
      const canned = cleanCanned(body)
      if (!canned) return json({ error: 'Give the reply a title and some text.' }, 400)
      const existing = id(body.id)
      if (!existing && (await store.countCanned(d1)) >= MAX_CANNED) return json({ error: `You can keep up to ${MAX_CANNED} canned replies.` }, 400)
      await store.saveCanned(d1, existing || null, canned, nowIso)
      return json({ ok: true })
    }
    case 'canned-delete': {
      const denied = adminOnly()
      if (denied) return denied
      await store.deleteCanned(d1, id(body.id))
      return json({ ok: true })
    }
    case 'settings': {
      const denied = adminOnly()
      if (denied) return denied
      await store.saveSettings(d1, cleanSettings(body.settings as Record<string, unknown>), nowIso)
      return json({ ok: true })
    }
    case 'purge': {
      const denied = adminOnly()
      if (denied) return denied
      const cutoff = retentionCutoff(now, (await store.getSettings(d1)).retentionDays)
      if (!cutoff) return json({ error: 'Chats are kept until erased. Set a number of days first.' }, 400)
      return json({ ok: true, removed: await store.purgeClosedBefore(d1, cutoff) })
    }
    default:
      return json({ error: 'Unknown action.' }, 400)
  }
}
