import type { CollectionConfig, CollectionBeforeChangeHook } from '@/engine'

import { isAdmin, roleAccess } from '@/access/ecommerceAccess'

import { APPROVAL_COLLECTIONS } from './settings'
import { BUILT_IN_ROLE_SLUGS, namedUserIds, validateWorkflowInput, WORKFLOWS_SLUG } from './workflows'

/**
 * Checks a workflow before it is saved: a name, a content type, at least one step, every step
 * named with an approver role and a whole number of approvals, every role real, and no second
 * active workflow for the same content type. The REST write is already admin-only; this keeps a
 * bad flow from ever reaching the review engine, whatever the client sent.
 */
export const validateWorkflowBeforeChange: CollectionBeforeChangeHook = async (args: unknown) => {
  const { data, originalDoc, req, operation } = args as {
    data: Record<string, unknown>
    originalDoc?: Record<string, unknown>
    req?: { engine?: { find: (a: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }> }; user?: unknown }
    operation: string
  }
  // System writes (seed scripts) have no user and are trusted; user writes are validated.
  if (!req?.user || !req.engine) return

  const merged = { ...(operation === 'update' ? originalDoc : {}), ...data }
  const roles = await req.engine.find({ collection: 'roles', limit: 1000, depth: 0, overrideAccess: true })
  const known = new Set<string>([...BUILT_IN_ROLE_SLUGS, ...roles.docs.map((role) => String(role.slug ?? '')).filter(Boolean)])
  const active = await req.engine.find({
    collection: WORKFLOWS_SLUG,
    where: { active: { equals: true } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const selfId = operation === 'update' ? Number(originalDoc?.id) : null
  const wantedUsers = namedUserIds(Array.isArray(merged.steps) ? (merged.steps as Array<{ approverUsers?: unknown }>) : [], merged.authorRoutes, merged.standIns)
  const knownUsers = new Set<number>()
  if (wantedUsers.length > 0) {
    const found = await req.engine.find({ collection: 'users', where: { id: { in: wantedUsers } }, limit: wantedUsers.length, depth: 0, overrideAccess: true })
    for (const user of found.docs) knownUsers.add(Number(user.id))
  }
  const problems = validateWorkflowInput(
    merged,
    known,
    active.docs.map((doc) => ({ id: Number(doc.id), collection: String(doc.collection) })),
    selfId,
    knownUsers,
  )
  if (problems.length > 0) {
    const { ValidationError } = await import('@/localapi/operations')
    throw new ValidationError(problems)
  }
}

/**
 * Named multi-step approval flows, one active per content type. Managed from the Roles page and
 * hidden from the nav; nothing here is public. Only admins may write, and only people who can
 * read the review queue may read (so the review panel can say who is being waited on).
 */
export const ApprovalWorkflows: CollectionConfig = {
  slug: WORKFLOWS_SLUG,
  dbName: 'eg_approval_workflows',
  labels: { singular: 'Approval workflow', plural: 'Approval workflows' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'collection', 'active'],
    group: 'Settings',
    hidden: true,
    description: 'Multi-step approval flows. Managed on the Roles page.',
  },
  access: {
    create: isAdmin,
    read: roleAccess('review', 'read'),
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: { beforeChange: [validateWorkflowBeforeChange] },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'collection',
      type: 'select',
      required: true,
      options: APPROVAL_COLLECTIONS.map((value) => ({ label: value, value })),
    },
    { name: 'active', type: 'checkbox', defaultValue: false },
    {
      name: 'allowRepeatApprover',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'When on, one person who can approve two steps may approve both in the same review. Off keeps each step to a different person.' },
    },
    {
      name: 'reviewDueDays',
      type: 'number',
      min: 0,
      max: 365,
      admin: { description: 'Days a review may wait. Past this the document shows as overdue and the approvers get one reminder email. Blank or 0 means no limit.' },
    },
    {
      name: 'submitterRoles',
      type: 'json',
      admin: { description: 'Role slugs that may submit. Empty means anyone who can edit this content.' },
    },
    {
      name: 'authorRoutes',
      type: 'json',
      admin: { description: 'Per-author approvers: { "<author user id>": [approver user ids] }. That author\'s work is approved by those people at every step.' },
    },
    {
      name: 'standIns',
      type: 'json',
      admin: { description: 'Stand-ins: [{ "userId": reviewer, "standInId": cover, "until": "YYYY-MM-DD" or null }]. While the reviewer is away the stand-in may approve what the reviewer could.' },
    },
    {
      name: 'steps',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'approverRoles', type: 'json', admin: { description: 'Role slugs that may approve this step. Admins always may.' } },
        { name: 'approvalsNeeded', type: 'number', required: true, defaultValue: 1, min: 1 },
        { name: 'approverUsers', type: 'json', admin: { description: 'User ids of named approvers for this step. When set, only they (and admins) approve it.' } },
        { name: 'alsoRoles', type: 'checkbox', defaultValue: false, admin: { description: 'With named approvers: the approver roles may also approve (a fallback).' } },
      ],
    },
  ],
  defaultSort: 'name',
}
