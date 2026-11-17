import { configuredSiteOrigin } from '@/utilities/siteOrigin'

import { APPROVAL_SINGULAR, loadApprovalSettings, type ApprovalCollection } from './settings'
import { notifyOverdue } from './notify'
import { sectionKeyOf } from './sections'
import { parseWorkflow, WORKFLOWS_SLUG } from './workflows'

/** The note on the review event that marks "reminded": one per review round, found again by the sweep so nobody is emailed twice. */
export const OVERDUE_NOTE = 'Overdue reminder sent'

const DAY = 86_400_000

/** When a review that started at `requestedAt` becomes overdue, or null when the workflow sets no limit. Pure. */
export function dueAt(requestedAt: string | null | undefined, dueDays: number | null | undefined): Date | null {
  const days = Math.floor(Number(dueDays) || 0)
  const start = requestedAt ? Date.parse(requestedAt) : NaN
  if (days <= 0 || !Number.isFinite(start)) return null
  return new Date(start + days * DAY)
}

/** True once a review has waited past its due date. Pure. */
export const isOverdue = (requestedAt: string | null | undefined, dueDays: number | null | undefined, now: Date): boolean => {
  const due = dueAt(requestedAt, dueDays)
  return due !== null && now.getTime() >= due.getTime()
}

type EngineLike = {
  find: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }>
  findByID: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  create: (args: Record<string, unknown>) => Promise<unknown>
}

/**
 * Emails the approvers once for each review that has waited past its workflow's due days, and records that on the
 * review history so the next run skips it. Returns how many reviews were chased. Never throws: a failure on one
 * document leaves the rest to run.
 */
export async function runOverdueReviewReminders(engine: EngineLike, now = new Date(), origin = configuredSiteOrigin()): Promise<number> {
  let chased = 0
  try {
    const settings = await loadApprovalSettings(engine as never)
    const { docs: rows } = await engine.find({ collection: WORKFLOWS_SLUG, where: { active: { equals: true } }, limit: 50, depth: 0, overrideAccess: true })
    for (const row of rows) {
      const workflow = parseWorkflow(row)
      const days = workflow?.reviewDueDays ?? 0
      if (!workflow || days <= 0) continue
      const collection: ApprovalCollection = workflow.collection
      const cutoff = new Date(now.getTime() - days * DAY).toISOString()
      const { docs } = await engine.find({
        collection,
        where: { and: [{ reviewStatus: { equals: 'in_review' } }, { reviewRequestedAt: { less_than_equal: cutoff } }] },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of docs) {
        const id = Number(doc.id)
        const requestedAt = typeof doc.reviewRequestedAt === 'string' ? doc.reviewRequestedAt : null
        if (!Number.isInteger(id) || !requestedAt) continue
        const reminded = await engine.find({
          collection: 'review-events',
          where: { and: [{ collection: { equals: collection } }, { docId: { equals: id } }, { note: { equals: OVERDUE_NOTE } }, { createdAt: { greater_than_equal: requestedAt } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (reminded.docs.length > 0) continue
        const title = String(doc.title ?? doc.name ?? `${APPROVAL_SINGULAR[collection]} ${id}`)
        const step = Math.max(0, Math.min(workflow.steps.length - 1, Number(doc.reviewStep) || 0))
        const requesterId = doc.reviewRequestedBy && typeof doc.reviewRequestedBy === 'object' ? Number((doc.reviewRequestedBy as { id?: unknown }).id) : Number(doc.reviewRequestedBy) || null
        const section = Object.keys(workflow.sectionRoutes ?? {}).length > 0 ? await sectionKeyOf(engine, collection, doc) : null
        const sent = await notifyOverdue({ engine, settings, collection, id, title, workflow, step, requesterId, origin, days, requestedAt, section }).catch((): string[] => [])
        await engine.create({
          collection: 'review-events',
          data: { collection, docId: id, docTitle: title, action: 'comment', note: OVERDUE_NOTE, step: workflow.steps[step]?.name ?? '', actorName: 'System' },
          overrideAccess: true,
        })
        if (sent.length > 0) chased += 1
      }
    }
  } catch {
    // The sweep must never fail the job it rides on.
  }
  return chased
}
