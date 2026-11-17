import { NextResponse } from 'next/server'

import { getAdminContext, hasAdminPanelAccess } from '@/admin/auth'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { runAction } from '@/features/taskboard/actions'
import { canAccessBoard, assignablePeople } from '@/features/taskboard/logic'
import * as store from '@/features/taskboard/store'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200): Response => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function guard() {
  const ctx = await getAdminContext()
  if (!hasAdminPanelAccess(ctx.user)) return { response: json({ error: 'Unauthorised' }, 401) }
  if (!(await getFeatureFlags()).taskboard) return { response: json({ error: 'Switch the Taskboard on in Site Settings first.' }, 409) }
  const user = ctx.user as { id: number | string; email?: string; displayName?: string }
  return { ctx, me: { id: Number(user.id), isAdmin: ctx.isAdmin, label: user.displayName || user.email || '' } }
}

/**
 * GET: the boards this person may open, the people who can be assigned, and (with ?board=<id>) that board's
 * columns, cards and recent activity; with ?card=<id> also that card's comments. Any admin or staff user.
 * POST: one action (see features/taskboard/actions.ts). Board settings are admin only.
 */
export async function GET(request: Request): Promise<Response> {
  const access = await guard()
  if (!access.ctx) return access.response!
  const d1 = (await rawD1()) as never as store.D1
  const url = new URL(request.url)
  const boards = (await store.listBoards(d1)).filter((b) => canAccessBoard(b, access.me))
  const people = await store.listPeople(d1)
  if (url.searchParams.get('mine') === '1') {
    const cards = await store.cardsForPerson(d1, access.me.id, boards.map((b) => b.id))
    return json({ me: { id: access.me.id, isAdmin: access.me.isAdmin }, cards })
  }
  const boardId = Number(url.searchParams.get('board'))
  const board = boards.find((b) => b.id === boardId)
  const out: Record<string, unknown> = { boards, me: { id: access.me.id, isAdmin: access.me.isAdmin }, people }
  if (board) {
    Object.assign(out, await store.boardData(d1, board.id), { board, assignable: assignablePeople(board, people) })
    const cardId = Number(url.searchParams.get('card'))
    if (Number.isInteger(cardId) && cardId > 0) out.comments = await store.listComments(d1, cardId)
  }
  return json(out)
}

export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return json({ error: refusal }, 403)
  const access = await guard()
  if (!access.ctx) return access.response!
  const body = (await request.json().catch((): null => null)) as Record<string, unknown> | null
  if (!body) return json({ error: 'Send the details as JSON.' }, 400)
  const d1 = (await rawD1()) as never as store.D1
  const { getEngine } = await import('@/engine')
  const { sendEmail } = await import('@/features/email')
  const { textToHtml } = await import('@/features/email/renderTemplate')
  const engine = await getEngine()
  const activityMark = await store.latestActivityId(d1).catch((): number => 0)
  const result = await runAction(
    {
      d1,
      nowIso: new Date().toISOString(),
      textToHtml,
      sendEmail: (args) => sendEmail(args),
      emit: async (event, data) => {
        const { emitWebhookEvent } = await import('@/features/webhooks/emit')
        await emitWebhookEvent(event, data)
      },
      hasRule: async (event) => {
        const [{ listRules }, { rulesFor }] = await Promise.all([import('@/features/notifications/store'), import('@/features/notifications/rules')])
        return rulesFor(await listRules(d1 as never), event).length > 0
      },
      siteName: async () => {
        try {
          const g = (await engine.findGlobal({ slug: 'site-details', depth: 0, overrideAccess: true })) as { businessName?: unknown }
          return typeof g.businessName === 'string' ? g.businessName : ''
        } catch {
          return ''
        }
      },
    },
    access.me,
    body,
  )
  // Everything this request added to the board's own activity trail is also written to the main Activity log.
  if (result.status === 200) {
    try {
      const [{ taskboardAuditEntry }, { audit, auditContext }, { getSecuritySettings }] = await Promise.all([import('@/features/taskboard/activityLog'), import('@/features/security/auditLog'), import('@/features/security/settings')])
      const settings = await getSecuritySettings(engine as unknown as Parameters<typeof getSecuritySettings>[0])
      const user = access.ctx.user as { email?: string }
      for (const row of await store.activitySince(d1, activityMark)) {
        await audit({ ...taskboardAuditEntry(row, { id: access.me.id, email: user.email }), ...auditContext(request) }, settings)
      }
    } catch {
      // The board's own trail already has it; the Activity log write is best effort.
    }
  }
  return json(result.body, result.status)
}
