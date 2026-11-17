import { moderatorMailText } from '@/features/comments/moderatorMail'
import { checkSpamRules } from '@/features/forms/spamRules'
import { DEFAULT_FORM_SETTINGS, getFormSettings } from '@/features/forms/settings'
import { NextResponse } from 'next/server'

import { buildTree, decideStatus, hashAddress, hitsBlockedWord, isClosed, validateComment } from '@/features/comments/core'
import * as store from '@/features/comments/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { authCaptchaRefusal } from '@/features/security/authCaptcha'
import { disposableRefusal } from '@/features/security/emailPolicy'
import { clientKey, hit } from '@/features/security/rateLimit'
import { getEngine } from '@/lib/engine'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const postId = (v: unknown): number => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** GET ?post=ID: the approved comments of a post as a tree, with no emails or addresses. */
export async function GET(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).comments) return json({ error: 'Comments are not switched on.' }, 404)
  const id = postId(new URL(request.url).searchParams.get('post'))
  if (!id) return json({ error: 'Missing post.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const settings = await store.getSettings(d1)
  const post = await store.postPublishedDate(d1, id)
  if (!post.exists) return json({ error: 'Not found.' }, 404)
  const rows = await store.approvedFor(d1, 'post', id)
  return json({ comments: buildTree(rows, settings.maxDepth), count: rows.length, maxDepth: settings.maxDepth, closed: isClosed(settings.closeAfterDays, post.publishedAt, new Date()) })
}

/** POST { post, parent?, name, email, content, website? }: add a comment. `website` is a honeypot. */
export async function POST(request: Request): Promise<Response> {
  if (!(await getFeatureFlags()).comments) return json({ error: 'Comments are not switched on.' }, 404)
  if (hit(`comment:${clientKey(request)}`, 5).limited) return json({ error: 'Too many comments. Try again in a little while.' }, 429)
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Invalid request.' }, 400)
  if (typeof body.website === 'string' && body.website.trim()) return json({ ok: true, status: 'pending' })
  const id = postId(body.post)
  if (!id) return json({ error: 'Missing post.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const settings = await store.getSettings(d1)
  const post = await store.postPublishedDate(d1, id)
  if (!post.exists) return json({ error: 'Not found.' }, 404)
  if (isClosed(settings.closeAfterDays, post.publishedAt, new Date())) return json({ error: 'Comments are closed on this post.' }, 403)

  const engine = await getEngine()
  const form = new FormData()
  for (const key of ['cf-turnstile-response', 'g-recaptcha-response']) if (typeof body[key] === 'string') form.set(key, body[key] as string)
  const challenge = await authCaptchaRefusal(engine as never, form, request.headers.get('cf-connecting-ip') ?? undefined, 'comments')
  if (challenge) return json({ error: challenge }, 400)
  const auth = (await engine.auth({ headers: request.headers }).catch(() => ({ user: null as unknown }))) as { user: { id?: number | string; email?: string; name?: string } | null }
  const user = auth.user
  const checked = validateComment({ name: body.name ?? user?.name, email: body.email ?? user?.email, content: body.content })
  if (checked.ok === false) return json({ error: checked.error }, 400)
  const { name, email, content } = checked.value
  const refusal = await disposableRefusal(engine as never, 'forms', email).catch((): null => null)
  if (refusal) return json({ error: refusal }, 400)

  let parentId: number | null = null
  if (body.parent != null) {
    parentId = postId(body.parent)
    if (!parentId || !(await store.parentBelongs(d1, parentId, 'post', id))) return json({ error: 'That comment cannot be replied to.' }, 400)
  }
  if (await store.isDuplicate(d1, 'post', id, email, content)) return json({ error: 'You already said that.' }, 409)
  const status = hitsBlockedWord(`${name} ${content}`, settings.blockedWords)
    ? 'spam'
    : decideStatus(settings, { content, signedIn: Boolean(user), hasApprovedBefore: await store.hasApprovedBefore(d1, email) })
  // The site-wide spam rules (Settings > Forms: blocked words, link limit, blocked senders) also apply to comments.
  const siteRules = status === 'spam' ? { spam: false } : checkSpamRules({ name, email, content }, await getFormSettings(engine as never).catch(() => DEFAULT_FORM_SETTINGS))
  const finalStatus = siteRules.spam ? 'spam' : status
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? ''
  const userId = user?.id != null && Number.isFinite(Number(user.id)) ? Number(user.id) : null
  await store.insertComment(d1, { refType: 'post', refId: id, parentId, name, email, userId, content, status: finalStatus, fromTeam: false, ipHash: await hashAddress(ip, 'eg-comments') }, new Date().toISOString())
  // Tell the admins when a comment is waiting for approval. Best effort; COMMENT_EMAILS_OFF=1 switches it off.
  if (finalStatus === 'pending' && process.env.COMMENT_EMAILS_OFF !== '1') {
    void (async () => {
      const [{ adminEmails }, { sendEmail }, { adminHref }, { getAdminRoot }] = await Promise.all([
        import('@/features/security/sensitiveChanges'),
        import('@/features/email'),
        import('@/features/security/adminPath'),
        import('@/features/security/settings'),
      ])
      const to = await adminEmails(engine)
      if (to.length === 0) return
      const mail = moderatorMailText({ name, content, postId: id }, `${new URL(request.url).origin}${adminHref('/comments', await getAdminRoot())}`)
      await sendEmail({ to, subject: mail.subject, template: 'comments.moderation', text: mail.text })
    })().catch((): void => undefined)
  }
  // A comment marked spam looks accepted, so a spammer learns nothing.
  return json({ ok: true, status: finalStatus === 'approved' ? 'approved' : 'pending' })
}
