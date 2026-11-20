'use client'

import React, { useActionState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

import { Note, SubmitButton } from '@/features/accounts/components/FormBits'
import { usePortalText } from '@/features/accounts/components/PortalText'
import { IDLE, type ActionState } from '@/features/accounts/types'
import type { PortalStringKey } from '@/features/multilingual/portalStrings'

import {
  acceptInviteAction,
  acceptTransferAction,
  cancelTransferAction,
  createDelegationAction,
  declineTransferAction,
  revokeDelegationAction,
  adminDeleteOrganizationAction,
  adminSaveBrandingAction,
  saveBrandingAction,
  cancelInviteAction,
  changeMemberRoleAction,
  companyContentAccessAction,
  createOrganizationAction,
  createTeamAction,
  declineInviteAction,
  deleteOrganizationAction,
  deleteRoleAction,
  deleteTeamAction,
  inviteMemberAction,
  leaveOrganizationAction,
  removeMemberAction,
  resendInviteAction,
  saveRoleAction,
  teamMembershipAction,
  transferOwnershipAction,
  updateOrganizationAction,
} from '../actions.client'

/**
 * The organisation forms. Each posts to a server action that re-checks the
 * caller's membership and permission, so hiding a button here is a courtesy and
 * never the control. Every form carries the organisation id as a hidden field:
 * it names a row, and the service refuses anyone who is not a member of it.
 */

type Action = (state: ActionState, form: FormData) => Promise<ActionState>

const useForm = (action: Action) => useActionState<ActionState, FormData>(action, IDLE)

export const CreateOrganizationForm: React.FC = () => {
  const [state, action] = useForm(createOrganizationAction)
  const t = usePortalText()
  return (
    <form action={action} className="account-form">
      <label>
        {t('orgs.fieldName')}
        <input name="name" required minLength={2} maxLength={80} />
      </label>
      <label>
        {t('orgs.fieldSlug')}
        <input name="slug" maxLength={48} placeholder="example-co" />
      </label>
      <label>
        {t('orgs.fieldLogo')}
        <input name="logo" type="url" placeholder="https://" />
      </label>
      <label>
        {t('orgs.fieldMetadata')}
        <input name="metadata" placeholder='{"industry":"retail"}' />
      </label>
      <SubmitButton>{t('orgs.createButton')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export const EditOrganizationForm: React.FC<{ organizationId: string; name: string; slug: string; logo: string; metadata: string }> = ({ organizationId, name, slug, logo, metadata }) => {
  const [state, action] = useForm(updateOrganizationAction)
  const t = usePortalText()
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label>
        {t('orgs.fieldName')}
        <input name="name" defaultValue={name} required minLength={2} maxLength={80} />
      </label>
      <label>
        {t('orgs.fieldSlugPlain')}
        <input name="slug" defaultValue={slug} maxLength={48} />
      </label>
      <label>
        {t('orgs.fieldLogoPlain')}
        <input name="logo" type="url" defaultValue={logo} placeholder="https://" />
      </label>
      <label>
        {t('orgs.fieldMetadataJson')}
        <input name="metadata" defaultValue={metadata} />
      </label>
      <SubmitButton>{t('orgs.saveChanges')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export const InviteForm: React.FC<{ organizationId: string; roles: string[]; teams: { id: string; name: string }[] }> = ({ organizationId, roles, teams }) => {
  const [state, action] = useForm(inviteMemberAction)
  const t = usePortalText()
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label>
        {t('orgs.fieldEmail')}
        <input name="email" type="email" required autoComplete="off" />
      </label>
      <div className="account-form__row">
        <label>
          {t('orgs.fieldRole')}
          <select name="role" defaultValue="member">
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        {teams.length > 0 ? (
          <label>
            {t('orgs.fieldTeam')}
            <select name="teamId" defaultValue="">
              <option value="">{t('orgs.noTeam')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <SubmitButton>{t('orgs.sendInvite')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

/** One small form per row action: a hidden-field form with a single button. */
const RowForm: React.FC<{ action: Action; fields: Record<string, string>; label: PortalStringKey; variant?: 'primary' | 'ghost'; confirm?: PortalStringKey; children?: React.ReactNode }> = ({ action, fields, label, variant = 'ghost', confirm, children }) => {
  const [state, run] = useForm(action)
  const t = usePortalText()
  return (
    <form
      action={run}
      className="org-inline-form"
      onSubmit={(event) => {
        if (confirm && !window.confirm(t(confirm))) event.preventDefault()
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <SubmitButton variant={variant}>{t(label)}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export const ResendInviteForm: React.FC<{ organizationId: string; inviteId: string }> = (props) => <RowForm action={resendInviteAction} fields={props} label="orgs.resend" />
export const CancelInviteForm: React.FC<{ organizationId: string; inviteId: string }> = (props) => <RowForm action={cancelInviteAction} fields={props} label="orgs.cancelInvite" confirm="orgs.confirmCancelInvite" />
export const RemoveMemberForm: React.FC<{ organizationId: string; userId: string }> = (props) => <RowForm action={removeMemberAction} fields={props} label="orgs.remove" confirm="orgs.confirmRemove" />
export const TransferOwnershipForm: React.FC<{ organizationId: string; userId: string }> = (props) => (
  <RowForm action={transferOwnershipAction} fields={props} label="orgs.makeOwner" confirm="orgs.confirmTransferRequest" />
)
export const LeaveOrganizationForm: React.FC<{ organizationId: string }> = (props) => <RowForm action={leaveOrganizationAction} fields={props} label="orgs.leave" confirm="orgs.confirmLeave" />
export const DeleteOrganizationForm: React.FC<{ organizationId: string }> = (props) => (
  <RowForm action={deleteOrganizationAction} fields={props} label="orgs.deleteOrg" confirm="orgs.confirmDeleteOrg" />
)
export const DeleteTeamForm: React.FC<{ organizationId: string; teamId: string }> = (props) => <RowForm action={deleteTeamAction} fields={props} label="orgs.deleteTeam" confirm="orgs.confirmDeleteTeam" />
export const DeleteRoleForm: React.FC<{ organizationId: string; name: string }> = (props) => <RowForm action={deleteRoleAction} fields={props} label="orgs.deleteRole" confirm="orgs.confirmDeleteRole" />

export const ChangeRoleForm: React.FC<{ organizationId: string; userId: string; role: string; roles: string[] }> = ({ organizationId, userId, role, roles }) => {
  const t = usePortalText()
  return (
    <RowForm action={changeMemberRoleAction} fields={{ organizationId, userId }} label="orgs.changeRole">
      <select name="role" defaultValue={role} aria-label={t('orgs.fieldRole')}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </RowForm>
  )
}

export const TeamMembershipForm: React.FC<{ organizationId: string; teamId: string; present: boolean; candidates: { userId: string; label: string }[] }> = ({ organizationId, teamId, present, candidates }) => {
  const t = usePortalText()
  return (
    <RowForm action={teamMembershipAction} fields={{ organizationId, teamId, present: present ? 'yes' : 'no' }} label={present ? 'orgs.removeFromTeam' : 'orgs.addToTeam'}>
      <select name="userId" aria-label={t('orgs.ariaMember')}>
        {candidates.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.label}
          </option>
        ))}
      </select>
    </RowForm>
  )
}

export const CreateTeamForm: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const t = usePortalText()
  return (
    <RowForm action={createTeamAction} fields={{ organizationId }} label="orgs.createTeam" variant="primary">
      <input name="name" required minLength={2} maxLength={80} placeholder={t('orgs.teamName')} aria-label={t('orgs.teamName')} />
    </RowForm>
  )
}

export const RoleForm: React.FC<{ organizationId: string; actions: string[] }> = ({ organizationId, actions }) => {
  const [state, action] = useForm(saveRoleAction)
  const t = usePortalText()
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label>
        {t('orgs.fieldRoleName')}
        <input name="name" required pattern="[a-z][a-z0-9_-]{1,31}" />
      </label>
      <fieldset className="org-perms">
        <legend>{t('orgs.permissions')}</legend>
        {actions.map((a) => (
          <label key={a}>
            <input type="checkbox" name="permissions" value={a} /> {a}
          </label>
        ))}
      </fieldset>
      <SubmitButton>{t('orgs.saveRole')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export const InviteDecisionForm: React.FC<{ token: string }> = ({ token }) => {
  const [acceptState, accept] = useForm(acceptInviteAction)
  const [declineState, decline] = useForm(declineInviteAction)
  const t = usePortalText()
  return (
    <div className="account-card__actions">
      <form action={accept}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton>{t('orgs.acceptInvite')}</SubmitButton>
        <Note state={acceptState} />
      </form>
      <form action={decline}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton variant="ghost">{t('orgs.decline')}</SubmitButton>
        <Note state={declineState} />
      </form>
    </div>
  )
}

/** The admin screen's delete button. A plain form: the action re-checks the administrator on the server. */
export const AdminDeleteOrganizationForm: React.FC<{ organizationId: string; name: string }> = ({ organizationId, name }) => {
  const t = useAdminT()
  return (
    <form
      action={adminDeleteOrganizationAction}
      onSubmit={(event) => {
        if (!window.confirm(t('cu.lit.confirm_delete_org', { name }))) event.preventDefault()
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <button type="submit" className="btn btn--ghost">
        {t('cu.lit.delete')}
      </button>
    </form>
  )
}

/** Who may read one company document: checked members and teams, or nobody checked = every member. */
export const ContentAccessForm: React.FC<{ organizationId: string; collection: string; docId: number; subjects: { value: string; label: string; checked: boolean }[] }> = ({ organizationId, collection, docId, subjects }) => {
  const [state, action] = useForm(companyContentAccessAction)
  const t = usePortalText()
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="collection" value={collection} />
      <input type="hidden" name="docId" value={String(docId)} />
      <fieldset>
        <legend className="org-muted">{t('orgs.contentWho')}</legend>
        {subjects.map((s) => (
          <label key={s.value}>
            <input type="checkbox" name="grant" value={s.value} defaultChecked={s.checked} /> {s.label}
          </label>
        ))}
      </fieldset>
      <SubmitButton>{t('orgs.contentSave')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export type BrandingValues = {
  primary: string
  accent: string
  background: string
  text: string
  headingFont: string
  bodyFont: string
  /** Section ids in the company's order, with the ones that are hidden. */
  order: string[]
  hidden: string[]
}

/** Texts for the branding form, resolved by the screen that renders it (the portal's or the admin's). */
export type BrandingLabels = Record<
  | 'title' | 'help' | 'primary' | 'accent' | 'background' | 'text' | 'hint' | 'headingFont' | 'bodyFont' | 'position' | 'show' | 'save'
  | 'fontDefault' | 'fontSystem' | 'fontSerif' | 'fontMono' | 'fontRounded'
  | 'members' | 'teams' | 'content' | 'invitations' | 'roles' | 'details',
  string
>

const FONT_LABEL_KEYS = { default: 'fontDefault', system: 'fontSystem', serif: 'fontSerif', mono: 'fontMono', rounded: 'fontRounded' } as const

/** One company's colours, fonts and portal layout. The company's owners use it; so does a site administrator (override). */
export const BrandingForm: React.FC<{ organizationId: string; values: BrandingValues; labels: BrandingLabels; admin?: boolean }> = ({ organizationId, values, labels, admin }) => {
  const [state, action] = useForm(admin ? adminSaveBrandingAction : saveBrandingAction)
  const colours = ['primary', 'accent', 'background', 'text'] as const
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <p className="org-muted">{labels.help}</p>
      <div className="account-form__row">
        {colours.map((field) => (
          <label key={field}>
            {labels[field]}
            <input name={field} defaultValue={values[field]} maxLength={80} placeholder={labels.hint} />
          </label>
        ))}
      </div>
      <div className="account-form__row">
        {(['headingFont', 'bodyFont'] as const).map((field) => (
          <label key={field}>
            {labels[field]}
            <select name={field} defaultValue={values[field]}>
              {(Object.keys(FONT_LABEL_KEYS) as (keyof typeof FONT_LABEL_KEYS)[]).map((name) => (
                <option key={name} value={name}>
                  {labels[FONT_LABEL_KEYS[name]]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <ul className="org-list">
        {values.order.map((section, index) => (
          <li key={section} className="org-row">
            <div className="org-row__main">{labels[section as keyof BrandingLabels]}</div>
            <div className="org-row__actions">
              <label>
                {labels.position}
                <input name={`pos_${section}`} type="number" min={1} max={values.order.length} defaultValue={index + 1} style={{ width: '4.5rem' }} />
              </label>
              <label>
                <input name={`show_${section}`} type="checkbox" value="yes" defaultChecked={!values.hidden.includes(section)} disabled={section === 'details'} />
                {labels.show}
              </label>
              {section === 'details' ? <input type="hidden" name="show_details" value="yes" /> : null}
            </div>
          </li>
        ))}
      </ul>
      <SubmitButton>{labels.save}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export const TransferDecisionForm: React.FC<{ token: string }> = ({ token }) => {
  const [acceptState, accept] = useForm(acceptTransferAction)
  const [declineState, decline] = useForm(declineTransferAction)
  const t = usePortalText()
  return (
    <div className="account-card__actions">
      <form action={accept}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton>{t('orgs.acceptTransfer')}</SubmitButton>
        <Note state={acceptState} />
      </form>
      <form action={decline}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton variant="ghost">{t('orgs.decline')}</SubmitButton>
        <Note state={declineState} />
      </form>
    </div>
  )
}

export const CancelTransferForm: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [state, action] = useForm(cancelTransferAction)
  const t = usePortalText()
  return (
    <form action={action} className="org-inline-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <SubmitButton variant="ghost">{t('orgs.cancelTransfer')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

export const RevokeDelegationForm: React.FC<{ organizationId: string; delegationId: string }> = ({ organizationId, delegationId }) => {
  const [state, action] = useForm(revokeDelegationAction)
  const t = usePortalText()
  return (
    <form action={action} className="org-inline-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="delegationId" value={delegationId} />
      <SubmitButton variant="ghost">{t('orgs.endDelegation')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}

/** Lets another account act for the signed-in member here. `rights` is only what this member holds and may delegate. */
export const DelegationForm: React.FC<{ organizationId: string; rights: { value: string; label: string }[] }> = ({ organizationId, rights }) => {
  const [state, action] = useForm(createDelegationAction)
  const t = usePortalText()
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="organizationId" value={organizationId} />
      <label>
        {t('orgs.delegateEmail')}
        <input name="email" type="email" required autoComplete="off" />
      </label>
      <fieldset className="org-perms">
        <legend>{t('orgs.delegateRights')}</legend>
        {rights.map((r) => (
          <label key={r.value}>
            <input type="checkbox" name="permissions" value={r.value} /> {r.label}
          </label>
        ))}
      </fieldset>
      <label>
        {t('orgs.delegateHours')}
        <input name="hours" type="number" min={1} max={2160} defaultValue={24} required />
      </label>
      <SubmitButton>{t('orgs.delegateSave')}</SubmitButton>
      <Note state={state} />
    </form>
  )
}
