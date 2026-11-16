import type { OrganizationSettings } from '@/features/security/settings'

import { keepBrandingKeys, sanitiseBranding, sanitiseLayout, withBrandingAndLayout } from './branding'
import { cleanPermissions, isBuiltInRole, permissionsForRole, roleHasPermission, type CustomRoles, type OrgAction } from './permissions'
import {
  inviteExpiry,
  inviteProblem,
  isInviteTokenShape,
  isLastOwner,
  mayAssignRole,
  mayManageMember,
  normaliseEmail,
  normaliseLogo,
  normaliseMetadata,
  normaliseName,
  normaliseSlug,
  normaliseTeamName,
  roleShapeOk,
} from './policy'
import { isOrgVisibleCollection } from './visibility'
import type { CompanyDocRow, DelegationRow, GrantRow, InviteRow, MemberRow, OrgRow, OrgStore, OrgSummary, RoleRow } from './types'

/**
 * Every organisation operation, with every side effect passed in. The server
 * actions supply the real store, mailer and audit log; the tests supply
 * SQLite-backed or in-memory doubles. The signed-in account is always the
 * caller's own `actor` - nothing here takes "who is asking" from an input.
 *
 * Hiding rule: someone who is not a member of an organisation gets
 * `not_found`, exactly as if it did not exist, so ids cannot be probed.
 */

export type Refusal =
  | 'disabled'
  | 'signed_out'
  | 'not_found'
  | 'forbidden'
  | 'invalid'
  | 'slug_taken'
  | 'limit_reached'
  | 'creation_restricted'
  | 'last_owner'
  | 'owner_protected'
  | 'already_member'
  | 'already_invited'
  | 'rate_limited'
  | 'invite_invalid'
  | 'invite_used'
  | 'invite_expired'
  | 'wrong_account'
  | 'role_in_use'
  | 'email_failed'
  | 'transfer_invalid'
  | 'transfer_used'
  | 'transfer_expired'
  | 'transfer_wrong_account'
  | 'delegation_invalid'

export const REFUSAL_MESSAGES: Record<Refusal, string> = {
  disabled: 'Organisations are not available on this site.',
  signed_out: 'Your session has ended. Sign in and try again.',
  not_found: 'That organisation could not be found.',
  forbidden: 'You do not have permission to do that.',
  invalid: 'Check the details and try again.',
  slug_taken: 'That web address name is already in use. Choose another.',
  limit_reached: 'You have reached the most organisations one account may own.',
  creation_restricted: 'Only site administrators can create organisations here.',
  last_owner: 'An organisation must keep at least one owner. Transfer ownership first.',
  owner_protected: 'Only an owner can change or remove an owner.',
  already_member: 'That person is already a member.',
  already_invited: 'That email address already has a pending invitation. Resend it instead.',
  rate_limited: 'Too many invitations sent just now. Try again in a minute.',
  invite_invalid: 'This invitation link is not valid.',
  invite_used: 'This invitation has already been used, declined or cancelled.',
  invite_expired: 'This invitation has expired. Ask for a new one.',
  wrong_account: 'This invitation was sent to a different email address. Sign in with that account.',
  role_in_use: 'That role is still held by a member or a pending invitation.',
  email_failed: 'The invitation was saved but the email could not be sent. Try resending it.',
  transfer_invalid: 'This ownership transfer link is not valid.',
  transfer_used: 'This ownership transfer has already been accepted, declined or cancelled.',
  transfer_expired: 'This ownership transfer has expired. Ask the owner to start it again.',
  transfer_wrong_account: 'This ownership transfer was offered to a different account. Sign in with that account.',
  delegation_invalid: 'Check the person, the rights and the end time and try again.',
}

/** Flat on purpose (see types.ts). `ok` false means `code` and `message` are set. */
export type Result<T = undefined> = { ok: boolean; code?: Refusal; message?: string; value?: T }

const fail = <T = undefined>(code: Refusal, message?: string): Result<T> => ({ ok: false, code, message: message ?? REFUSAL_MESSAGES[code] })
/** Carries a refusal across to another result type. */
const pass = <T = undefined>(r: Result<unknown>): Result<T> => ({ ok: false, code: r.code, message: r.message })
const done = <T = undefined>(value?: T): Result<T> => ({ ok: true, value })

export type Actor = { id: number; email: string; roles: unknown }

export type OrgAuditEntry = {
  action:
    | 'organization.created'
    | 'organization.updated'
    | 'organization.deleted'
    | 'organization.member-removed'
    | 'organization.member-left'
    | 'organization.role-changed'
    | 'organization.owner-transferred'
    | 'organization.invite-sent'
    | 'organization.invite-accepted'
    | 'organization.invite-declined'
    | 'organization.invite-canceled'
    | 'organization.refused'
    | 'organization.transfer-requested'
    | 'organization.transfer-accepted'
    | 'organization.transfer-declined'
    | 'organization.transfer-canceled'
    | 'organization.delegation-created'
    | 'organization.delegation-revoked'
    | 'organization.delegate-action'
  actorId: number | null
  actorEmail: string | null
  organizationId: string | null
  detail: string
}

export type InviteMail = { to: string; organizationName: string; inviterEmail: string; role: string; link: string; expiresAt: string }

export type TransferMail = { to: string; organizationName: string; fromEmail: string; link: string; expiresAt: string }

export type OrgDeps = {
  settings: OrganizationSettings
  store: OrgStore
  now: () => number
  newId: () => string
  newToken: () => string
  hashToken: (token: string) => Promise<string>
  /** The site address the invitation link starts with, no trailing slash. */
  origin: string
  /** Sends the invitation email. A false answer means it did not go out. */
  sendInvite: (mail: InviteMail) => Promise<boolean>
  /** True when this key may send another invitation now. */
  allowInviteSend: (key: string) => boolean
  findUserIdByEmail: (email: string) => Promise<number | null>
  emailOf: (userId: number) => Promise<string | null>
  /** Sends the ownership transfer confirmation. A false answer means it did not go out. */
  sendTransfer: (mail: TransferMail) => Promise<boolean>
  audit: (entry: OrgAuditEntry) => Promise<void>
}

export const isSiteAdmin = (roles: unknown): boolean => Array.isArray(roles) && roles.includes('admin')

const customRolesOf = (roles: RoleRow[]): CustomRoles => Object.fromEntries(roles.map((r) => [r.name, r.permissions]))

type Standing = { org: OrgRow; member: MemberRow; custom: CustomRoles; delegation?: DelegationRow }

/** Rights a member may hand to a delegate. Never membership, role or ownership rights, so a delegate cannot widen their own access. */
export const DELEGABLE_ACTIONS: readonly OrgAction[] = ['organization:read', 'organization:update', 'member:read', 'invitation:read', 'team:read', 'team:manage', 'content:read', 'content:manage']

export const DELEGATE_ROLE = 'delegate'

/** The caller's membership, or a delegated standing, or null when they have neither (or the organisation is gone). */
async function standing(deps: OrgDeps, actor: Actor, orgId: string): Promise<Standing | null> {
  const org = await deps.store.getOrg(orgId)
  if (!org) return null
  const member = await deps.store.getMember(orgId, actor.id)
  if (member) {
    const custom = isBuiltInRole(member.role) ? {} : customRolesOf(await deps.store.listRoles(orgId))
    return { org, member, custom }
  }
  return delegatedStanding(deps, org, actor)
}

/** A delegate holds what was granted, cut down to what the delegator holds right now. If the delegator has left, the delegation gives nothing. */
async function delegatedStanding(deps: OrgDeps, org: OrgRow, actor: Actor): Promise<Standing | null> {
  const now = new Date(deps.now()).toISOString()
  const delegation = await deps.store.findActiveDelegation(org.id, actor.id, now)
  if (!delegation) return null
  const delegator = await deps.store.getMember(org.id, delegation.delegatorId)
  if (!delegator) return null
  const custom = isBuiltInRole(delegator.role) ? {} : customRolesOf(await deps.store.listRoles(org.id))
  const held = permissionsForRole(delegator.role, custom)
  const granted = delegation.permissions.filter((p): p is OrgAction => (DELEGABLE_ACTIONS as readonly string[]).includes(p) && held.includes(p as OrgAction))
  const row: MemberRow = { id: `delegation:${delegation.id}`, organizationId: org.id, userId: actor.id, role: DELEGATE_ROLE, createdAt: delegation.createdAt }
  return { org, member: row, custom: { [DELEGATE_ROLE]: granted }, delegation }
}

const can = (s: Standing, action: OrgAction): boolean => roleHasPermission(s.member.role, action, s.custom)

const refuse = async <T = undefined>(deps: OrgDeps, actor: Actor | null, orgId: string | null, code: Refusal, detail: string): Promise<Result<T>> => {
  await deps.audit({ action: 'organization.refused', actorId: actor?.id ?? null, actorEmail: actor?.email ?? null, organizationId: orgId, detail: `${code}: ${detail}` })
  return fail<T>(code)
}

const gate = (deps: OrgDeps, actor: Actor | null): Result | null => {
  if (!deps.settings.enabled) return fail('disabled')
  if (!actor) return fail('signed_out')
  return null
}

/** Reads a membership-gated organisation: non-members are told it does not exist. */
async function member(deps: OrgDeps, actor: Actor, orgId: string, action: OrgAction): Promise<Result<Standing>> {
  const s = await standing(deps, actor, orgId)
  if (!s) return fail<Standing>('not_found')
  if (!can(s, action)) return refuse<Standing>(deps, actor, orgId, 'forbidden', action)
  // Every change made through a delegation is on the record, with whose rights were used.
  if (s.delegation && !action.endsWith(':read')) {
    await deps.audit({ action: 'organization.delegate-action', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `${action} acting for user ${s.delegation.delegatorId}` })
  }
  return done(s)
}

// --- Organisations --------------------------------------------------------

export type CreateInput = { name: unknown; slug?: unknown; logo?: unknown; metadata?: unknown }

export async function createOrganization(deps: OrgDeps, actor: Actor | null, input: CreateInput): Promise<Result<OrgRow>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<OrgRow>
  if (deps.settings.whoMayCreate === 'admins' && !isSiteAdmin(actor.roles)) return refuse<OrgRow>(deps, actor, null, 'creation_restricted', 'create')
  const name = normaliseName(input.name)
  const slug = normaliseSlug(input.slug === undefined || input.slug === '' ? input.name : input.slug)
  const logo = normaliseLogo(input.logo)
  const metadata = normaliseMetadata(input.metadata)
  if (!name || !slug || !logo.ok || !metadata.ok) return fail<OrgRow>('invalid')
  if ((await deps.store.countOwnedBy(actor.id)) >= deps.settings.maxPerAccount) return refuse<OrgRow>(deps, actor, null, 'limit_reached', 'create')
  if (await deps.store.getOrgBySlug(slug)) return fail<OrgRow>('slug_taken')

  const at = new Date(deps.now()).toISOString()
  const row: OrgRow = { id: deps.newId(), name, slug, logo: logo.value, metadata: metadata.value, createdBy: actor.id, createdAt: at, updatedAt: at }
  try {
    await deps.store.insertOrg(row)
  } catch {
    // The unique slug index decides a race between two creators.
    return fail<OrgRow>('slug_taken')
  }
  await deps.store.insertMember({ id: deps.newId(), organizationId: row.id, userId: actor.id, role: 'owner', createdAt: at })
  await deps.audit({ action: 'organization.created', actorId: actor.id, actorEmail: actor.email, organizationId: row.id, detail: `${row.name} (${row.slug})` })
  return done(row)
}

export async function updateOrganization(deps: OrgDeps, actor: Actor | null, orgId: string, input: Partial<CreateInput>): Promise<Result<OrgRow>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<OrgRow>
  const g = await member(deps, actor, orgId, 'organization:update')
  if (!g.ok) return pass(g)
  const patch: { name?: string; slug?: string; logo?: string | null; metadata?: string | null } = {}
  if (input.name !== undefined) {
    const name = normaliseName(input.name)
    if (!name) return fail<OrgRow>('invalid')
    patch.name = name
  }
  if (input.slug !== undefined && input.slug !== '') {
    const slug = normaliseSlug(input.slug)
    if (!slug) return fail<OrgRow>('invalid')
    const clash = await deps.store.getOrgBySlug(slug)
    if (clash && clash.id !== orgId) return fail<OrgRow>('slug_taken')
    patch.slug = slug
  }
  if (input.logo !== undefined) {
    const logo = normaliseLogo(input.logo)
    if (!logo.ok) return fail<OrgRow>('invalid')
    patch.logo = logo.value
  }
  if (input.metadata !== undefined) {
    const metadata = normaliseMetadata(input.metadata)
    if (!metadata.ok) return fail<OrgRow>('invalid')
    // A free-form edit never wipes the company's branding and layout; those have their own form.
    patch.metadata = keepBrandingKeys(metadata.value, g.value.org.metadata)
  }
  try {
    await deps.store.updateOrg(orgId, patch, new Date(deps.now()).toISOString())
  } catch {
    return fail<OrgRow>('slug_taken')
  }
  await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: Object.keys(patch).join(', ') })
  return done((await deps.store.getOrg(orgId)) ?? g.value.org)
}

export type BrandingInput = { branding: unknown; layout: unknown }

const writeBranding = async (deps: OrgDeps, org: OrgRow, input: BrandingInput): Promise<Result<OrgRow>> => {
  const text = withBrandingAndLayout(org.metadata, sanitiseBranding(input.branding), sanitiseLayout(input.layout))
  if (text === null) return fail<OrgRow>('invalid')
  await deps.store.updateOrg(org.id, { metadata: text === '' ? null : text }, new Date(deps.now()).toISOString())
  return done((await deps.store.getOrg(org.id)) ?? org)
}

/** A company sets its own colours, fonts and portal layout. Needs the right to update the organisation. */
export async function saveOrganizationBranding(deps: OrgDeps, actor: Actor | null, orgId: string, input: BrandingInput): Promise<Result<OrgRow>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<OrgRow>
  const g = await member(deps, actor, orgId, 'organization:update')
  if (!g.ok) return pass(g)
  const result = await writeBranding(deps, g.value.org, input)
  if (result.ok) await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: 'branding and layout' })
  return result
}

/** Super admin override: sets any company's branding and layout, even with customer organisations switched off. */
export async function adminSaveOrganizationBranding(deps: OrgDeps, admin: Actor | null, orgId: string, input: BrandingInput): Promise<Result<OrgRow>> {
  if (!admin) return fail<OrgRow>('signed_out')
  if (!isSiteAdmin(admin.roles)) return refuse<OrgRow>(deps, admin, orgId, 'forbidden', 'admin branding')
  const org = await deps.store.getOrg(orgId)
  if (!org) return fail<OrgRow>('not_found')
  const result = await writeBranding(deps, org, input)
  if (result.ok) await deps.audit({ action: 'organization.updated', actorId: admin.id, actorEmail: admin.email, organizationId: orgId, detail: 'branding and layout, by site administrator' })
  return result
}

/** Owner-only deletion of one's own organisation. */
export async function deleteOrganization(deps: OrgDeps, actor: Actor | null, orgId: string): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'organization:delete')
  if (!g.ok) return pass(g)
  await deps.store.deleteOrg(orgId)
  await deps.audit({ action: 'organization.deleted', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `${g.value.org.name} (${g.value.org.slug})` })
  return done()
}

/** A site administrator deleting any organisation from the admin screen. Works even when customer organisations are switched off, so they can be cleaned up. */
export async function adminDeleteOrganization(deps: OrgDeps, admin: Actor | null, orgId: string): Promise<Result> {
  if (!admin) return fail('signed_out')
  if (!isSiteAdmin(admin.roles)) return refuse(deps, admin, orgId, 'forbidden', 'admin delete')
  const org = await deps.store.getOrg(orgId)
  if (!org) return fail('not_found')
  await deps.store.deleteOrg(orgId)
  await deps.audit({ action: 'organization.deleted', actorId: admin.id, actorEmail: admin.email, organizationId: orgId, detail: `by site administrator: ${org.name} (${org.slug})` })
  return done()
}

export async function adminListOrganizations(deps: Pick<OrgDeps, 'store'>, admin: Actor | null): Promise<Result<OrgSummary[]>> {
  if (!admin) return fail<OrgSummary[]>('signed_out')
  if (!isSiteAdmin(admin.roles)) return fail<OrgSummary[]>('forbidden')
  return done(await deps.store.listAllOrgs(200))
}

export async function listMyOrganizations(deps: OrgDeps, actor: Actor | null): Promise<Result<(OrgRow & { role: string })[]>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<(OrgRow & { role: string })[]>
  const own = await deps.store.listOrgsForUser(actor.id)
  const delegated = await deps.store.listDelegatedOrgs(actor.id, new Date(deps.now()).toISOString())
  const extra = delegated.filter((o) => !own.some((m) => m.id === o.id)).map(({ delegatorId: _d, ...rest }) => ({ ...rest, role: DELEGATE_ROLE }))
  return done([...own, ...extra])
}

const pendingOf = async (deps: OrgDeps, orgId: string): Promise<{ toUserId: number; expiresAt: string } | null> => {
  const row = await deps.store.getPendingTransfer(orgId)
  return row && Date.parse(row.expiresAt) > deps.now() ? { toUserId: row.toUserId, expiresAt: row.expiresAt } : null
}

export type OrgDetail = {
  org: OrgRow
  myRole: string
  permissions: OrgAction[]
  members: (MemberRow & { teamIds: string[] })[]
  teams: { id: string; name: string; memberCount: number; memberIds: number[] }[]
  /** Without the token hash: nothing derived from a link leaves the service. */
  invites: Omit<InviteRow, 'tokenHash'>[]
  roles: RoleRow[]
  /** Set when the caller is acting through a delegation. */
  actingFor: { delegatorId: number; expiresAt: string } | null
  pendingTransfer: { toUserId: number; expiresAt: string } | null
  delegations: DelegationRow[]
}

/** Members only. Invitations are visible only to those who may read them. */
export async function getOrganization(deps: OrgDeps, actor: Actor | null, orgId: string): Promise<Result<OrgDetail>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<OrgDetail>
  const g = await member(deps, actor, orgId, 'organization:read')
  if (!g.ok) return pass(g)
  const s = g.value
  const [members, teams, roles, invites] = await Promise.all([
    can(s, 'member:read') ? deps.store.listMembers(orgId) : Promise.resolve([s.member]),
    can(s, 'team:read') ? deps.store.listTeams(orgId) : Promise.resolve([]),
    deps.store.listRoles(orgId),
    can(s, 'invitation:read') ? deps.store.listInvites(orgId) : Promise.resolve([]),
  ])
  const teamDetails = await Promise.all(teams.map(async (t) => ({ id: t.id, name: t.name, memberCount: t.memberCount, memberIds: await deps.store.listTeamMembers(t.id) })))
  return done({
    org: s.org,
    myRole: s.member.role,
    permissions: [...permissionsForRole(s.member.role, s.custom)],
    members: members.map((m) => ({ ...m, teamIds: teamDetails.filter((t) => t.memberIds.includes(m.userId)).map((t) => t.id) })),
    teams: teamDetails,
    invites: invites.map(({ tokenHash: _hash, ...rest }) => rest),
    roles,
    actingFor: s.delegation ? { delegatorId: s.delegation.delegatorId, expiresAt: s.delegation.expiresAt } : null,
    pendingTransfer: s.member.role === 'owner' && !s.delegation ? await pendingOf(deps, orgId) : null,
    delegations: (await deps.store.listActiveDelegations(orgId, new Date(deps.now()).toISOString())).filter((d) => s.member.role === 'owner' || d.delegatorId === actor.id || d.delegateId === actor.id),
  })
}

// --- Members --------------------------------------------------------------

async function roleExists(deps: OrgDeps, orgId: string, role: string): Promise<boolean> {
  if (isBuiltInRole(role)) return true
  return Boolean(await deps.store.getRole(orgId, role))
}

export async function changeMemberRole(deps: OrgDeps, actor: Actor | null, orgId: string, targetUserId: number, newRole: unknown): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'member:update')
  if (!g.ok) return pass(g)
  if (!roleShapeOk(newRole) || !(await roleExists(deps, orgId, newRole))) return fail('invalid')
  const target = await deps.store.getMember(orgId, targetUserId)
  if (!target) return fail('not_found')
  if (!mayManageMember(g.value.member.role, target.role) || !mayAssignRole(g.value.member.role, newRole)) {
    return refuse(deps, actor, orgId, 'owner_protected', `role of ${targetUserId}`)
  }
  if (target.role === newRole) return done()
  if (!(await deps.store.setMemberRole(orgId, targetUserId, newRole))) return refuse(deps, actor, orgId, 'last_owner', `role of ${targetUserId}`)
  await deps.audit({ action: 'organization.role-changed', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `user ${targetUserId}: ${target.role} -> ${newRole}` })
  return done()
}

export async function removeMember(deps: OrgDeps, actor: Actor | null, orgId: string, targetUserId: number): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  if (actor && targetUserId === actor.id) return leaveOrganization(deps, actor, orgId)
  const g = await member(deps, actor, orgId, 'member:remove')
  if (!g.ok) return pass(g)
  const target = await deps.store.getMember(orgId, targetUserId)
  if (!target) return fail('not_found')
  if (!mayManageMember(g.value.member.role, target.role)) return refuse(deps, actor, orgId, 'owner_protected', `remove ${targetUserId}`)
  if (!(await deps.store.removeMember(orgId, targetUserId))) return refuse(deps, actor, orgId, 'last_owner', `remove ${targetUserId}`)
  await deps.audit({ action: 'organization.member-removed', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `user ${targetUserId} (${target.role})` })
  return done()
}

/** Anyone may leave, except the last owner, who must transfer ownership or delete the organisation. */
export async function leaveOrganization(deps: OrgDeps, actor: Actor | null, orgId: string): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const s = await standing(deps, actor, orgId)
  if (!s) return fail('not_found')
  if (!(await deps.store.removeMember(orgId, actor.id))) return refuse(deps, actor, orgId, 'last_owner', 'leave')
  await deps.audit({ action: 'organization.member-left', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `role ${s.member.role}` })
  return done()
}

const TRANSFER_TTL_DAYS = 7

/** Step one: the owner names a member. Nothing changes yet; the member is emailed a link and must confirm it themselves. A new request replaces an older pending one. */
export async function requestOwnershipTransfer(deps: OrgDeps, actor: Actor | null, orgId: string, newOwnerId: number): Promise<Result<{ emailSent: boolean }>> {
  type R = Result<{ emailSent: boolean }>
  const blocked = gate(deps, actor)
  if (blocked) return blocked as R
  const g = await member(deps, actor, orgId, 'organization:transfer')
  if (!g.ok) return pass<R['value']>(g)
  if (g.value.delegation || g.value.member.role !== 'owner') return refuse(deps, actor, orgId, 'forbidden', 'transfer') as Promise<R>
  if (newOwnerId === actor.id) return fail('invalid') as R
  const target = await deps.store.getMember(orgId, newOwnerId)
  const to = target ? await deps.emailOf(newOwnerId) : null
  if (!target || !to) return fail('not_found') as R
  const now = deps.now()
  const token = deps.newToken()
  const expiresAt = new Date(now + TRANSFER_TTL_DAYS * 86_400_000).toISOString()
  const at = new Date(now).toISOString()
  await deps.store.insertTransfer({ id: deps.newId(), organizationId: orgId, fromUserId: actor.id, toUserId: newOwnerId, tokenHash: await deps.hashToken(token), status: 'pending', expiresAt, createdAt: at, resolvedAt: null }, at)
  const emailSent = await deps.sendTransfer({ to, organizationName: g.value.org.name, fromEmail: actor.email, link: `${deps.origin}/account/transfer/${encodeURIComponent(token)}`, expiresAt })
  await deps.audit({ action: 'organization.transfer-requested', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `to user ${newOwnerId}${emailSent ? '' : ' (email not sent)'}` })
  return { ok: true, value: { emailSent }, message: emailSent ? undefined : 'The request was saved but the email could not be sent. Request it again.' }
}

export type TransferPreview = { organizationName: string; fromEmail: string; expiresAt: string; usable: boolean; mine: boolean; problem: Refusal | null }

const transferProblem = (row: { status: string; expiresAt: string }, now: number): Refusal | null => {
  if (row.status !== 'pending') return 'transfer_used'
  if (Date.parse(row.expiresAt) <= now) return 'transfer_expired'
  return null
}

export async function previewOwnershipTransfer(deps: OrgDeps, actor: Actor | null, token: unknown): Promise<Result<TransferPreview>> {
  if (!deps.settings.enabled) return fail<TransferPreview>('disabled')
  if (!isInviteTokenShape(token)) return fail<TransferPreview>('transfer_invalid')
  const row = await deps.store.getTransferByTokenHash(await deps.hashToken(token))
  if (!row) return fail<TransferPreview>('transfer_invalid')
  const org = await deps.store.getOrg(row.organizationId)
  if (!org) return fail<TransferPreview>('transfer_invalid')
  const problem = transferProblem(row, deps.now())
  return done({ organizationName: org.name, fromEmail: (await deps.emailOf(row.fromUserId)) ?? '', expiresAt: row.expiresAt, usable: problem === null, mine: actor?.id === row.toUserId, problem })
}

async function claimTransfer(deps: OrgDeps, actor: Actor | null, token: unknown, status: 'accepted' | 'declined'): Promise<Result<{ organizationId: string }>> {
  type R = Result<{ organizationId: string }>
  const blocked = gate(deps, actor)
  if (blocked) return blocked as R
  if (!isInviteTokenShape(token)) return fail('transfer_invalid') as R
  const row = await deps.store.getTransferByTokenHash(await deps.hashToken(token))
  if (!row) return refuse(deps, actor, null, 'transfer_invalid', 'unknown token') as Promise<R>
  const problem = transferProblem(row, deps.now())
  if (problem) return refuse(deps, actor, row.organizationId, problem, 'ownership transfer') as Promise<R>
  // The link alone is not enough: only the account it was offered to may answer it.
  if (row.toUserId !== actor.id) return refuse(deps, actor, row.organizationId, 'transfer_wrong_account', 'ownership transfer') as Promise<R>
  if (status === 'accepted') {
    // Both people must still hold their seats; the roles swap only if so.
    const from = await deps.store.getMember(row.organizationId, row.fromUserId)
    const to = await deps.store.getMember(row.organizationId, row.toUserId)
    if (!from || from.role !== 'owner' || !to) {
      await deps.store.resolveTransfer(row.id, 'canceled', new Date(deps.now()).toISOString(), new Date(deps.now()).toISOString())
      return refuse(deps, actor, row.organizationId, 'transfer_invalid', 'seats changed') as Promise<R>
    }
  }
  const at = new Date(deps.now()).toISOString()
  if (!(await deps.store.resolveTransfer(row.id, status, at, at))) return refuse(deps, actor, row.organizationId, 'transfer_used', 'lost the claim') as Promise<R>
  if (status === 'accepted') {
    // The new owner is added first, so there is never a moment without an owner.
    await deps.store.setMemberRole(row.organizationId, row.toUserId, 'owner')
    await deps.store.setMemberRole(row.organizationId, row.fromUserId, 'admin')
  }
  await deps.audit({ action: status === 'accepted' ? 'organization.transfer-accepted' : 'organization.transfer-declined', actorId: actor.id, actorEmail: actor.email, organizationId: row.organizationId, detail: `from user ${row.fromUserId}` })
  return done({ organizationId: row.organizationId })
}

export const acceptOwnershipTransfer = (deps: OrgDeps, actor: Actor | null, token: unknown) => claimTransfer(deps, actor, token, 'accepted')
export const declineOwnershipTransfer = (deps: OrgDeps, actor: Actor | null, token: unknown) => claimTransfer(deps, actor, token, 'declined')

/** The owner withdraws a pending request. */
export async function cancelOwnershipTransfer(deps: OrgDeps, actor: Actor | null, orgId: string): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'organization:transfer')
  if (!g.ok) return pass(g)
  const pending = await deps.store.getPendingTransfer(orgId)
  if (!pending) return fail('not_found')
  const at = new Date(deps.now()).toISOString()
  if (!(await deps.store.resolveTransfer(pending.id, 'canceled', at, at))) return fail('transfer_used')
  await deps.audit({ action: 'organization.transfer-canceled', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `to user ${pending.toUserId}` })
  return done()
}

// --- Delegation -----------------------------------------------------------

export const MAX_DELEGATION_DAYS = 90
export const MIN_DELEGATION_HOURS = 1

export type DelegationInput = { email: unknown; permissions: unknown; hours: unknown }

/** A member lets another account act for them here, for chosen rights, for a limited time. The rights can never exceed the member's own, or be ones that change membership. */
export async function createDelegation(deps: OrgDeps, actor: Actor | null, orgId: string, input: DelegationInput): Promise<Result<DelegationRow>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<DelegationRow>
  const g = await member(deps, actor, orgId, 'organization:read')
  if (!g.ok) return pass(g)
  // Only a real member delegates; a delegate cannot pass their access on.
  if (g.value.delegation) return refuse<DelegationRow>(deps, actor, orgId, 'forbidden', 'delegate cannot delegate')
  const email = normaliseEmail(input.email)
  const hours = Number(input.hours)
  const held = permissionsForRole(g.value.member.role, g.value.custom)
  const wanted = (Array.isArray(input.permissions) ? input.permissions : []).filter((p): p is OrgAction => (DELEGABLE_ACTIONS as readonly string[]).includes(p as string))
  const permissions = [...new Set(wanted)].filter((p) => held.includes(p))
  if (!email || permissions.length === 0 || !Number.isFinite(hours) || hours < MIN_DELEGATION_HOURS || hours > MAX_DELEGATION_DAYS * 24) return fail<DelegationRow>('delegation_invalid')
  const delegateId = await deps.findUserIdByEmail(email)
  // Same answer for "no such account" as for a bad request, so this cannot be used to look up who has an account.
  if (delegateId === null || delegateId === actor.id) return fail<DelegationRow>('delegation_invalid')
  if (await deps.store.getMember(orgId, delegateId)) return fail<DelegationRow>('already_member')
  const now = deps.now()
  const row: DelegationRow = { id: deps.newId(), organizationId: orgId, delegatorId: actor.id, delegateId, permissions, expiresAt: new Date(now + hours * 3_600_000).toISOString(), createdAt: new Date(now).toISOString(), revokedAt: null }
  await deps.store.insertDelegation(row)
  await deps.audit({ action: 'organization.delegation-created', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `to user ${delegateId}: ${permissions.join(',')} until ${row.expiresAt}` })
  return done(row)
}

/** The delegator, an owner, or the delegate themself ends a delegation at once. */
export async function revokeDelegation(deps: OrgDeps, actor: Actor | null, orgId: string, delegationId: string): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const row = await deps.store.getDelegation(delegationId)
  if (!row || row.organizationId !== orgId) return fail('not_found')
  const mine = await deps.store.getMember(orgId, actor.id)
  const allowed = row.delegatorId === actor.id || row.delegateId === actor.id || mine?.role === 'owner'
  if (!allowed) return refuse(deps, actor, orgId, 'not_found' as Refusal, 'revoke delegation')
  if (!(await deps.store.revokeDelegation(delegationId, new Date(deps.now()).toISOString()))) return fail('not_found')
  await deps.audit({ action: 'organization.delegation-revoked', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `delegation to user ${row.delegateId}` })
  return done()
}

// --- Custom roles ---------------------------------------------------------

export async function saveCustomRole(deps: OrgDeps, actor: Actor | null, orgId: string, name: unknown, permissions: unknown): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'role:manage')
  if (!g.ok) return pass(g)
  if (!roleShapeOk(name) || isBuiltInRole(name)) return fail('invalid')
  const clean = cleanPermissions(permissions)
  // Nobody can hand out more than they hold.
  if (clean.some((action) => !can(g.value, action))) return refuse(deps, actor, orgId, 'forbidden', 'role permissions')
  await deps.store.upsertRole({ id: deps.newId(), organizationId: orgId, name, permissions: clean, createdAt: new Date(deps.now()).toISOString() })
  await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `role ${name}: ${clean.join(',')}` })
  return done()
}

export async function deleteCustomRole(deps: OrgDeps, actor: Actor | null, orgId: string, name: unknown): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'role:manage')
  if (!g.ok) return pass(g)
  if (!roleShapeOk(name) || isBuiltInRole(name)) return fail('invalid')
  if ((await deps.store.countMembersWithRoleName(orgId, name)) > 0) return fail('role_in_use')
  await deps.store.deleteRole(orgId, name)
  await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `role ${name} deleted` })
  return done()
}

// --- Teams ----------------------------------------------------------------

export async function createTeam(deps: OrgDeps, actor: Actor | null, orgId: string, nameInput: unknown): Promise<Result<{ id: string }>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<{ id: string }>
  const g = await member(deps, actor, orgId, 'team:manage')
  if (!g.ok) return pass(g)
  const name = normaliseTeamName(nameInput)
  if (!name) return fail<{ id: string }>('invalid')
  const id = deps.newId()
  if (!(await deps.store.insertTeam({ id, organizationId: orgId, name, createdAt: new Date(deps.now()).toISOString() }))) return fail<{ id: string }>('invalid', 'A team with that name already exists.')
  await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `team ${name} created` })
  return done({ id })
}

async function teamOf(deps: OrgDeps, orgId: string, teamId: string) {
  const team = await deps.store.getTeam(teamId)
  // A team id from another organisation is the same as no team.
  return team && team.organizationId === orgId ? team : null
}

export async function deleteTeam(deps: OrgDeps, actor: Actor | null, orgId: string, teamId: string): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'team:manage')
  if (!g.ok) return pass(g)
  const team = await teamOf(deps, orgId, teamId)
  if (!team) return fail('not_found')
  await deps.store.deleteTeam(teamId)
  await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `team ${team.name} deleted` })
  return done()
}

export async function setTeamMembership(deps: OrgDeps, actor: Actor | null, orgId: string, teamId: string, userId: number, present: boolean): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'team:manage')
  if (!g.ok) return pass(g)
  if (!(await teamOf(deps, orgId, teamId))) return fail('not_found')
  if (present) {
    if (!(await deps.store.getMember(orgId, userId))) return fail('not_found')
    await deps.store.addTeamMember(teamId, userId, new Date(deps.now()).toISOString())
  } else {
    await deps.store.removeTeamMember(teamId, userId)
  }
  return done()
}

// --- Company content access -------------------------------------------------

/** Documents limited to this company with who may read each. Needs content:manage. */
export async function listCompanyContent(deps: OrgDeps, actor: Actor | null, orgId: string): Promise<Result<CompanyDocRow[]>> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked as Result<CompanyDocRow[]>
  const g = await member(deps, actor, orgId, 'content:manage')
  if (!g.ok) return pass(g)
  return done(await deps.store.listCompanyDocs(orgId, 200))
}

/**
 * Narrows one company document to chosen members and teams (or opens it to every member again with an empty list).
 * Subjects must belong to this company; the document must be limited to this company by the site admin.
 */
export async function setCompanyContentAccess(deps: OrgDeps, actor: Actor | null, orgId: string, collection: unknown, docId: unknown, grantsInput: unknown): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'content:manage')
  if (!g.ok) return pass(g)
  if (!isOrgVisibleCollection(collection) || typeof docId !== 'number' || !Number.isInteger(docId) || docId <= 0) return fail('invalid')
  if (!(await deps.store.docBelongsToOrg(orgId, collection, docId))) return fail('not_found')
  const wanted = Array.isArray(grantsInput) ? (grantsInput as GrantRow[]) : []
  const clean: GrantRow[] = []
  for (const w of wanted.slice(0, 500)) {
    if (!w || (w.subjectType !== 'member' && w.subjectType !== 'team') || typeof w.subjectId !== 'string') return fail('invalid')
    if (w.subjectType === 'member') {
      const userId = Number(w.subjectId)
      if (!Number.isInteger(userId) || !(await deps.store.getMember(orgId, userId))) return fail('invalid')
    } else if (!(await teamOf(deps, orgId, w.subjectId))) return fail('invalid')
    clean.push({ subjectType: w.subjectType, subjectId: w.subjectId })
  }
  await deps.store.setGrants(orgId, collection, docId, clean, new Date(deps.now()).toISOString())
  await deps.audit({ action: 'organization.updated', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `content access ${collection}/${docId}: ${clean.length === 0 ? 'every member' : `${clean.length} selected`}` })
  return done()
}

// --- Invitations ----------------------------------------------------------

export type InviteInput = { email: unknown; role?: unknown; teamId?: unknown }

async function deliver(deps: OrgDeps, actor: Actor, s: Standing, invite: InviteRow, token: string): Promise<boolean> {
  return deps
    .sendInvite({ to: invite.email, organizationName: s.org.name, inviterEmail: actor.email, role: invite.role, link: `${deps.origin}/account/invite/${token}`, expiresAt: invite.expiresAt })
    .catch(() => false)
}

export async function inviteMember(deps: OrgDeps, actor: Actor | null, orgId: string, input: InviteInput): Promise<Result<{ id: string; emailSent: boolean }>> {
  type R = Result<{ id: string; emailSent: boolean }>
  const blocked = gate(deps, actor)
  if (blocked) return blocked as R
  const g = await member(deps, actor, orgId, 'invitation:create')
  if (!g.ok) return pass<R["value"]>(g)
  const email = normaliseEmail(input.email)
  const role = input.role === undefined || input.role === '' ? 'member' : input.role
  if (!email || !roleShapeOk(role) || !(await roleExists(deps, orgId, role))) return fail('invalid') as R
  if (!mayAssignRole(g.value.member.role, role)) return refuse(deps, actor, orgId, 'owner_protected', `invite as ${role}`) as Promise<R>
  let teamId: string | null = null
  if (typeof input.teamId === 'string' && input.teamId !== '') {
    if (!(await teamOf(deps, orgId, input.teamId))) return fail('invalid') as R
    teamId = input.teamId
  }
  // Rate limit before any lookup that could reveal who has an account.
  if (!deps.allowInviteSend(`org-invite:${actor.id}`)) return refuse(deps, actor, orgId, 'rate_limited', email) as Promise<R>
  const existingId = await deps.findUserIdByEmail(email)
  if (existingId !== null && (await deps.store.getMember(orgId, existingId))) return fail('already_member') as R
  if (await deps.store.findPendingInvite(orgId, email)) return fail('already_invited') as R

  const now = deps.now()
  const token = deps.newToken()
  const row: InviteRow = {
    id: deps.newId(),
    organizationId: orgId,
    email,
    role,
    teamId,
    tokenHash: await deps.hashToken(token),
    status: 'pending',
    inviterId: actor.id,
    expiresAt: inviteExpiry(now),
    createdAt: new Date(now).toISOString(),
    resolvedAt: null,
    lastSentAt: new Date(now).toISOString(),
  }
  await deps.store.insertInvite(row)
  const emailSent = await deliver(deps, actor, g.value, row, token)
  await deps.audit({ action: 'organization.invite-sent', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `${email} as ${role}${emailSent ? '' : ' (email not sent)'}` })
  return { ok: true, value: { id: row.id, emailSent }, message: emailSent ? undefined : REFUSAL_MESSAGES.email_failed }
}

async function inviteOf(deps: OrgDeps, orgId: string, inviteId: string): Promise<InviteRow | null> {
  const invite = await deps.store.getInvite(inviteId)
  return invite && invite.organizationId === orgId ? invite : null
}

/** A fresh link and a fresh expiry for a pending invitation. The old link stops working. */
export async function resendInvite(deps: OrgDeps, actor: Actor | null, orgId: string, inviteId: string): Promise<Result<{ emailSent: boolean }>> {
  type R = Result<{ emailSent: boolean }>
  const blocked = gate(deps, actor)
  if (blocked) return blocked as R
  const g = await member(deps, actor, orgId, 'invitation:create')
  if (!g.ok) return pass<R["value"]>(g)
  const invite = await inviteOf(deps, orgId, inviteId)
  if (!invite) return fail('not_found') as R
  if (invite.status !== 'pending') return fail('invite_used') as R
  if (!mayAssignRole(g.value.member.role, invite.role)) return refuse(deps, actor, orgId, 'owner_protected', 'resend') as Promise<R>
  if (!deps.allowInviteSend(`org-invite:${actor.id}`)) return refuse(deps, actor, orgId, 'rate_limited', invite.email) as Promise<R>
  const now = deps.now()
  const token = deps.newToken()
  const expiresAt = inviteExpiry(now)
  if (!(await deps.store.refreshInvite(inviteId, await deps.hashToken(token), expiresAt, new Date(now).toISOString()))) return fail('invite_used') as R
  const emailSent = await deliver(deps, actor, g.value, { ...invite, expiresAt }, token)
  await deps.audit({ action: 'organization.invite-sent', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: `resent to ${invite.email}${emailSent ? '' : ' (email not sent)'}` })
  return { ok: true, value: { emailSent }, message: emailSent ? undefined : REFUSAL_MESSAGES.email_failed }
}

export async function cancelInvite(deps: OrgDeps, actor: Actor | null, orgId: string, inviteId: string): Promise<Result> {
  const blocked = gate(deps, actor)
  if (blocked) return blocked
  const g = await member(deps, actor, orgId, 'invitation:cancel')
  if (!g.ok) return pass(g)
  const invite = await inviteOf(deps, orgId, inviteId)
  if (!invite) return fail('not_found')
  const at = new Date(deps.now()).toISOString()
  if (!(await deps.store.resolveInvite(inviteId, 'canceled', at, at))) return fail('invite_used')
  await deps.audit({ action: 'organization.invite-canceled', actorId: actor.id, actorEmail: actor.email, organizationId: orgId, detail: invite.email })
  return done()
}

export type InvitePreview = { organizationName: string; role: string; email: string; expiresAt: string; usable: boolean; problem: Refusal | null }

const PROBLEM_CODES = { used: 'invite_used', canceled: 'invite_used', declined: 'invite_used', expired: 'invite_expired' } as const

/** What the accept page shows. Reveals only the organisation's name, the role and the invited address, and only to the holder of the token. */
export async function previewInvite(deps: OrgDeps, token: unknown): Promise<Result<InvitePreview>> {
  if (!deps.settings.enabled) return fail<InvitePreview>('disabled')
  if (!isInviteTokenShape(token)) return fail<InvitePreview>('invite_invalid')
  const invite = await deps.store.getInviteByTokenHash(await deps.hashToken(token))
  if (!invite) return fail<InvitePreview>('invite_invalid')
  const org = await deps.store.getOrg(invite.organizationId)
  if (!org) return fail<InvitePreview>('invite_invalid')
  const problem = inviteProblem(invite, deps.now())
  return done({ organizationName: org.name, role: invite.role, email: invite.email, expiresAt: invite.expiresAt, usable: problem === null, problem: problem ? PROBLEM_CODES[problem] : null })
}

async function claimInvite(deps: OrgDeps, actor: Actor | null, token: unknown, status: 'accepted' | 'declined'): Promise<Result<{ organizationId: string }>> {
  type R = Result<{ organizationId: string }>
  const blocked = gate(deps, actor)
  if (blocked) return blocked as R
  if (!isInviteTokenShape(token)) return fail('invite_invalid') as R
  const invite = await deps.store.getInviteByTokenHash(await deps.hashToken(token))
  if (!invite) return refuse(deps, actor, null, 'invite_invalid', 'unknown token') as Promise<R>
  const problem = inviteProblem(invite, deps.now())
  if (problem) return refuse(deps, actor, invite.organizationId, PROBLEM_CODES[problem], `invitation ${problem}`) as Promise<R>
  if (normaliseEmail(actor.email) !== invite.email) return refuse(deps, actor, invite.organizationId, 'wrong_account', 'invitation email differs') as Promise<R>
  const at = new Date(deps.now()).toISOString()
  // One statement decides who wins a double click or two devices: only a still-pending, unexpired invitation changes.
  if (!(await deps.store.resolveInvite(invite.id, status, at, at))) return refuse(deps, actor, invite.organizationId, 'invite_used', 'lost the claim') as Promise<R>
  if (status === 'accepted') {
    await deps.store.insertMember({ id: deps.newId(), organizationId: invite.organizationId, userId: actor.id, role: invite.role, createdAt: at })
    if (invite.teamId && (await teamOf(deps, invite.organizationId, invite.teamId))) await deps.store.addTeamMember(invite.teamId, actor.id, at)
  }
  await deps.audit({
    action: status === 'accepted' ? 'organization.invite-accepted' : 'organization.invite-declined',
    actorId: actor.id,
    actorEmail: actor.email,
    organizationId: invite.organizationId,
    detail: `${invite.email} as ${invite.role}`,
  })
  return done({ organizationId: invite.organizationId })
}

/** Only the signed-in account whose email the invitation was sent to may accept. */
export const acceptInvite = (deps: OrgDeps, actor: Actor | null, token: unknown) => claimInvite(deps, actor, token, 'accepted')
export const declineInvite = (deps: OrgDeps, actor: Actor | null, token: unknown) => claimInvite(deps, actor, token, 'declined')

// --- Active organisation --------------------------------------------------

/**
 * The organisation a session is working in. `preferredId` is what the session
 * remembers (a cookie); it is honoured only while the account is still a
 * member, otherwise the first organisation by name, otherwise none.
 */
export async function resolveActiveOrganization(deps: Pick<OrgDeps, 'store' | 'settings'>, userId: number | null, preferredId: string | null | undefined): Promise<OrgRow | null> {
  if (!deps.settings.enabled || userId === null) return null
  const mine = await deps.store.listOrgsForUser(userId)
  if (mine.length === 0) return null
  return mine.find((o) => o.id === preferredId) ?? mine[0]
}

export { isLastOwner }
