'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import {
  RESOURCES,
  BUILT_IN_ROLES,
  type PermissionMatrix,
  type Resource,
} from '@/features/roles/permissions'
import { PermissionTable } from '@/admin/components/PermissionTable'
import {
  copyMatrix,
  validateRoleName,
  slugify,
} from '@/features/roles/matrixUi'
import { errorMessageFrom, unwrapDoc, type WorkflowRecord } from '@/features/approval/workflowForm'
import { ApprovalWorkflowsPanel } from './ApprovalWorkflowsPanel'
import './roles-workflows.css'

interface RoleDoc {
  id: number
  name: string
  slug: string
  description?: string
  builtIn?: boolean
  permissions?: Partial<PermissionMatrix>
}

interface RolesViewClientProps {
  roles: RoleDoc[]
  canEdit: boolean
  /** Approval workflows, managed on the second tab. */
  workflows?: WorkflowRecord[]
  /** Staff who can be named as approvers. */
  people?: Array<{ id: number; name: string }>
  /** Sections that can be given their own approvers: top-level pages and post categories. */
  sections?: Partial<Record<'pages' | 'posts', Array<{ key: string; label: string }>>>
  /** Whether content approval is switched on in Security settings. */
  approvalEnabled?: boolean
}

type RolesTab = 'permissions' | 'workflows'

/*
 * Inline on purpose: the tab bar must read as tabs even when the stylesheet
 * loses a cascade fight with the admin theme. Colours come from the
 * --rw-* tokens that roles-workflows.css defines for light and dark.
 */
const TAB_BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  margin: '0 0 1.5rem',
  borderBottom: '1px solid var(--rw-border, #e4e4e7)',
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.6rem 1rem',
    margin: '0 0 -1px',
    border: '1px solid transparent',
    borderBottom: `3px solid ${active ? 'var(--rw-accent, #2563eb)' : 'transparent'}`,
    borderRadius: '4px 4px 0 0',
    background: 'transparent',
    color: active ? 'var(--rw-accent, #2563eb)' : 'inherit',
    font: 'inherit',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

/**
 * Roles admin view client: list, select, create, edit matrix, save, delete.
 */
export function RolesViewClient({ roles: initialRoles, canEdit, workflows = [], people = [], sections = {}, approvalEnabled = true }: RolesViewClientProps) {
  const t = useAdminT()
  const [tab, setTab] = useState<RolesTab>('permissions')

  // UI state
  const [roles, setRoles] = useState<RoleDoc[]>(initialRoles)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Get selected role or create dialog state
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId),
    [roles, selectedRoleId],
  )

  /**
   * Handle permission matrix changes
   */
  const handleMatrixChange = useCallback(
    (newMatrix: Partial<PermissionMatrix>) => {
      if (!selectedRole || selectedRole.builtIn) return
      setRoles((prev) =>
        prev.map((r) => {
          if (r.id === selectedRole.id) {
            return { ...r, permissions: newMatrix }
          }
          return r
        }),
      )
    },
    [selectedRole],
  )

  /**
   * Save role matrix to server
   */
  const handleSaveMatrix = useCallback(async () => {
    if (!selectedRole || !canEdit) return

    setSavingId(selectedRole.id)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedRole.permissions }),
      })

      if (!res.ok) {
        setErrorMsg(errorMessageFrom(await res.json().catch((): null => null), t('roles.error.save')))
      } else {
        // REST answers { doc, message }
        const updated = unwrapDoc<RoleDoc>(await res.json().catch((): null => null))
        if (updated) {
          setRoles((prev) =>
            prev.map((r) => (r.id === selectedRole.id ? updated : r)),
          )
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('roles.error.network')
      setErrorMsg(errMsg)
    } finally {
      setSavingId(null)
    }
  }, [selectedRole, canEdit])

  /**
   * Create new custom role
   */
  const handleCreate = useCallback(async () => {
    const validation = validateRoleName(createForm.name, Object.keys(BUILT_IN_ROLES))
    if (!validation.valid) {
      setErrorMsg(validation.error || t('roles.error.invalidName'))
      return
    }

    setSavingId(-1)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          slug: slugify(createForm.name),
          description: createForm.description,
          builtIn: false,
          permissions: {} as PermissionMatrix,
        }),
      })

      if (!res.ok) {
        setErrorMsg(errorMessageFrom(await res.json().catch((): null => null), t('roles.error.create')))
      } else {
        const newRole = unwrapDoc<RoleDoc>(await res.json().catch((): null => null))
        if (newRole) {
          setRoles((prev: RoleDoc[]) => [...prev, newRole])
          setSelectedRoleId(newRole.id)
        }
        setShowCreateDialog(false)
        setCreateForm({ name: '', description: '' })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('roles.error.network')
      setErrorMsg(errMsg)
    } finally {
      setSavingId(null)
    }
  }, [createForm])

  /**
   * Duplicate role
   */
  const handleDuplicate = useCallback(async () => {
    if (!selectedRole || !canEdit) return

    setSavingId(-2)
    setErrorMsg(null)

    try {
      const newName = `${selectedRole.name} (copy)`
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          slug: slugify(newName),
          description: selectedRole.description,
          builtIn: false,
          permissions: copyMatrix((selectedRole.permissions as PermissionMatrix) || {}, [...RESOURCES] as Resource[]),
        }),
      })

      if (!res.ok) {
        setErrorMsg(errorMessageFrom(await res.json().catch((): null => null), t('roles.error.duplicate')))
      } else {
        const newRole = unwrapDoc<RoleDoc>(await res.json().catch((): null => null))
        if (newRole) {
          setRoles((prev: RoleDoc[]) => [...prev, newRole])
          setSelectedRoleId(newRole.id)
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('roles.error.network')
      setErrorMsg(errMsg)
    } finally {
      setSavingId(null)
    }
  }, [selectedRole, canEdit])

  /**
   * Delete role
   */
  const handleDelete = useCallback(async () => {
    if (!selectedRole || selectedRole.builtIn || !canEdit) return
    if (deletingId !== selectedRole.id) {
      setDeletingId(selectedRole.id)
      return
    }

    setSavingId(selectedRole.id)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/roles/${selectedRole.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        setErrorMsg(errorMessageFrom(await res.json().catch((): null => null), t('roles.error.delete')))
      } else {
        setRoles((prev) => prev.filter((r) => r.id !== selectedRole.id))
        setSelectedRoleId(null)
        setDeletingId(null)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('roles.error.network')
      setErrorMsg(errMsg)
    } finally {
      setSavingId(null)
    }
  }, [selectedRole, canEdit, deletingId])

  return (
    <div className="eg-roles-container">
      <div className="eg-roles-header">
        <h1>{t('roles.title')}</h1>
        <p>{t('roles.description')}</p>
      </div>

      <div className="rw-tabs" role="tablist" aria-label={t('roles.tabsAria')} style={TAB_BAR_STYLE}>
        <button type="button" role="tab" id="roles-tab-permissions" aria-selected={tab === 'permissions'} aria-controls="roles-panel-permissions" className="rw-tab" style={tabStyle(tab === 'permissions')} onClick={() => setTab('permissions')}>
          {t('roles.tabPermissions')}
        </button>
        <button type="button" role="tab" id="roles-tab-workflows" aria-selected={tab === 'workflows'} aria-controls="roles-panel-workflows" className="rw-tab" style={tabStyle(tab === 'workflows')} onClick={() => setTab('workflows')}>
          {t('roles.tabWorkflows')}
        </button>
      </div>

      {tab === 'workflows' && (
        <div role="tabpanel" id="roles-panel-workflows" aria-labelledby="roles-tab-workflows">
          <ApprovalWorkflowsPanel
            workflows={workflows}
            roles={roles}
            people={people}
            sections={sections}
            canEdit={canEdit}
            approvalEnabled={approvalEnabled}
          />
        </div>
      )}

      <div className="eg-roles-rolesContainer" role="tabpanel" id="roles-panel-permissions" aria-labelledby="roles-tab-permissions" style={tab !== 'permissions' ? { display: 'none' } : undefined}>
        {/* Left: role list */}
        <div className="eg-roles-rolesList">
          <div className="eg-roles-rolesHeader">
            <h2>{t('roles.title')}</h2>
            {canEdit && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="eg-roles-btnPrimary"
              >
                {t('roles.createButton')}
              </button>
            )}
          </div>

          {/* Create dialog */}
          {showCreateDialog && (
            <div className="eg-roles-dialog">
              <div className="eg-roles-dialogContent">
                <h3>{t('roles.createHeading')}</h3>
                <input
                  type="text"
                  placeholder={t('roles.namePlaceholder')}
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="eg-roles-input"
                />
                <textarea
                  placeholder={t('roles.descriptionPlaceholder')}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="eg-roles-input"
                  rows={3}
                />
                <div className="eg-roles-dialogActions">
                  <button
                    onClick={() => {
                      setShowCreateDialog(false)
                      setCreateForm({ name: '', description: '' })
                      setErrorMsg(null)
                    }}
                    className="eg-roles-btnSecondary"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={savingId === -1}
                    className="eg-roles-btnPrimary"
                  >
                    {savingId === -1 ? t('roles.creating') : t('edit.create')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Role list items */}
          {roles.map((role) => (
            <div
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`eg-roles-roleItem ${selectedRoleId === role.id ? 'eg-roles-roleItemActive' : ''}`}
            >
              <div className="eg-roles-roleItemName">{role.name}</div>
              {role.builtIn && <span className="eg-roles-badge">{t('roles.builtIn')}</span>}
            </div>
          ))}
        </div>

        {/* Right: matrix editor or empty state */}
        <div className="eg-roles-matrixPanel">
          {selectedRole ? (
            <div>
              <div className="eg-roles-matrixHeader">
                <div>
                  <h2>{selectedRole.name}</h2>
                  {selectedRole.description && <p className="eg-roles-desc">{selectedRole.description}</p>}
                  {selectedRole.builtIn && <p className="eg-roles-readOnly">{t('roles.readOnlyBuiltIn')}</p>}
                </div>
                {!selectedRole.builtIn && canEdit && (
                  <div className="eg-roles-matrixActions">
                    <button
                      onClick={handleDuplicate}
                      disabled={savingId !== null}
                      className="eg-roles-btnSecondary"
                    >
                      {t('common.duplicate')}
                    </button>
                    <button
                      onClick={handleSaveMatrix}
                      disabled={savingId !== null || selectedRole.builtIn}
                      className="eg-roles-btnPrimary"
                    >
                      {savingId === selectedRole.id ? t('common.saving') : t('common.save')}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={savingId !== null || selectedRole.builtIn}
                      className="eg-roles-btnDanger"
                    >
                      {deletingId === selectedRole.id ? t('roles.confirmDelete') : t('common.delete')}
                    </button>
                  </div>
                )}
              </div>

              {errorMsg && <div className="eg-roles-error">{errorMsg}</div>}

              {/* Permission matrix */}
              <PermissionTable
                value={selectedRole.builtIn ? BUILT_IN_ROLES[selectedRole.slug] : (selectedRole.permissions || {})}
                onChange={handleMatrixChange}
                readOnly={selectedRole.builtIn || !canEdit}
                secretLocked={true}
                mode="matrix"
              />
            </div>
          ) : (
            <div className="eg-roles-emptyState">
              <p>{t('roles.selectRole')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
