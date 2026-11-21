import type { CollectionConfig, CollectionBeforeChangeHook } from '@/engine'

import { webhookUserAfterChange } from '@/features/webhooks/hooks'
import { allowedDomainsGuard } from '@/features/domains/access'
import { allowedDomainsField } from '@/features/domains/field'
import { isAdmin, isAdminOrSelf, adminOnlyFieldAccess } from '../access/ecommerceAccess'
import { validateRoleChange, sanitizeOverrides } from '@/features/roles/permissions'
import { slugify } from '@/utilities/formatSlug'
import { STEP_UP_COOKIE, STEP_UP_MESSAGE, grantsAdmin, hasValidStepUp, readCookie } from '@/features/security/stepUp'
import { revokeSessionsOnPasswordChange } from '@/features/security/passwordSessionHook'
import { enforcePasswordPolicyBeforeChange, recordPasswordAfterChange } from '@/features/security/passwordPolicyHooks'
import { authorshipFields, authorshipBeforeChange } from '../fields/authorship'
import { ADMIN_UI_LOCALES, ADMIN_UI_LOCALE_LABELS } from '@/features/uiStrings/locales'

/**
 * Validates role changes to prevent removing the last admin or self-lockout.
 */
const validateUserRoleChange: CollectionBeforeChangeHook = async (args: unknown): Promise<void> => {
  const { data, originalDoc, req, operation } = args as {
    data: { roles?: unknown }
    originalDoc?: { id?: number; roles?: string[] | null }
    req: { user?: Parameters<typeof validateRoleChange>[0]['actor']; engine: { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> } }
    operation?: string
  }

  // Only validate updates
  if (operation !== 'update') return

  // Only validate if roles are being changed
  const newRoles = data.roles
  if (!newRoles || !Array.isArray(newRoles)) return
  if (!originalDoc?.id) return

  // Count remaining admins from the database
  const { docs: adminDocs } = await req.engine.find({
    collection: 'users',
    where: { roles: { in: ['admin'] } },
    limit: 0,
    overrideAccess: true,
  })

  const adminCount = (adminDocs as unknown[]).length
  const isRemovingAdmin = originalDoc.roles?.includes('admin') && !newRoles.includes('admin')
  const newAdminCount = isRemovingAdmin ? adminCount - 1 : adminCount

  // Validate the role change
  const validation = validateRoleChange({
    actor: req.user,
    target: originalDoc,
    newRoles,
    adminCount: newAdminCount,
  })

  if (!validation.ok) {
    const error = new Error(validation.reason || 'Invalid role change')
    Object.assign(error, { statusCode: 400 })
    throw error
  }
}

/**
 * Adding an administrator (a create with the admin role, or an update that adds it) needs a recent
 * password or code confirmation from the signed-in admin making the change. Internal calls with no
 * signed-in user, and the very first admin, are not asked. See features/security/stepUp.ts.
 */
const requireStepUpForAdminGrant: CollectionBeforeChangeHook = async (args: unknown): Promise<void> => {
  const { data, originalDoc, req } = args as {
    data: { roles?: unknown }
    originalDoc?: { roles?: string[] | null }
    req: { user?: { id?: number | string } | null; headers?: Headers; engine: { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> } }
  }
  if (!grantsAdmin(originalDoc?.roles, data.roles)) return
  const actorId = Number(req.user?.id)
  if (!req.user || !Number.isInteger(actorId) || !req.headers) return

  const { docs } = await req.engine.find({ collection: 'users', where: { roles: { in: ['admin'] } }, limit: 1, depth: 0, overrideAccess: true })
  if (docs.length === 0) return

  const secret = process.env.ENGAGE_SECRET || ''
  if (secret && (await hasValidStepUp(readCookie(req.headers.get('cookie'), STEP_UP_COOKIE), actorId, secret))) return
  const error = new Error(STEP_UP_MESSAGE)
  Object.assign(error, { statusCode: 403 })
  throw error
}

/**
 * Sanitizes permission overrides to remove invalid resources/actions and ensure safe storage.
 */
const sanitizePermissionOverrides: CollectionBeforeChangeHook = async (args: unknown): Promise<void> => {
  const { data } = args as { data: { permissionOverrides?: unknown } }

  if (data.permissionOverrides !== undefined) {
    data.permissionOverrides = JSON.stringify(sanitizeOverrides(data.permissionOverrides))
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  dbName: 'eg_users',
  admin: {
    useAsTitle: 'email',
    group: 'Settings',
  },
  // Without these the engine falls back to "anyone signed in", and this
  // collection is not admins-only - the shop plugin maps every customer onto
  // it. That default let any customer account change an admin's email and
  // password, then log in as that admin. Field-level access on `roles` did not
  // help, because taking over the account never needed the role changed.
  access: {
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  auth: true,
  hooks: { afterChange: [revokeSessionsOnPasswordChange, recordPasswordAfterChange, webhookUserAfterChange] },
  beforeChange: [allowedDomainsGuard, requireStepUpForAdminGrant, validateUserRoleChange, sanitizePermissionOverrides, authorshipBeforeChange, enforcePasswordPolicyBeforeChange],
  fields: [
    allowedDomainsField,
    ...authorshipFields,
    {
      name: 'displayName',
      type: 'text',
      admin: { description: 'Public author name shown on blog posts. Optional. Never use an email address. Unused while authors are switched off in Blog settings.' },
    },
    {
      // Own profile picture, shown beside the name in the admin sidebar. Set on My preferences.
      name: 'photo',
      type: 'relationship',
      relationTo: 'media',
      admin: { description: 'Profile picture shown in the admin sidebar.' },
    },
    {
      // Optional sign-in name (Task 23g). Lowercase, unique; set by the account holder on the profile screen.
      // Used only when Security, Username sign-in is on. Mirror: src/migrations/20270317_130000_username_sign_in.ts.
      name: 'username',
      type: 'text',
      unique: true,
      admin: { description: 'Optional sign-in name, 3 to 32 letters, digits, underscores or dashes. Stored lowercase. Works at the sign-in form only while Username sign-in is on in Security.' },
      hooks: {
        beforeValidate: [
          ({ value }: { value?: unknown }) => {
            if (value === undefined) return undefined
            const clean = typeof value === 'string' ? value.trim().toLowerCase() : ''
            return clean || null
          },
        ],
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: { description: 'Author archive address: /blog/author/<slug>. Auto-fills from the display name. Unused while authors or author archives are switched off in Blog settings.' },
      hooks: {
        beforeValidate: [
          ({ data, value }: { data?: Record<string, unknown>; value?: unknown }) => {
            const raw = typeof value === 'string' && value.trim() ? value : typeof data?.displayName === 'string' ? data.displayName : ''
            return slugify(raw) || undefined
          },
        ],
      },
    },
    {
      name: 'emailVerifiedAt',
      type: 'date',
      admin: { description: 'When the customer confirmed their email address. Empty means not confirmed.' },
    },
    {
      // SHA-256 of the emailed token; the token itself is never stored.
      name: 'emailVerifyTokenHash',
      type: 'text',
      access: { read: () => false },
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'emailVerifyExpiresAt',
      type: 'date',
      admin: { hidden: true, readOnly: true },
    },
    {
      // JSON array of SHA-256 digests of the unused two-step backup codes. The
      // codes themselves are shown once at setup and never stored. The other
      // two-step columns are engine auth columns and are not fields at all.
      name: 'twoFactorBackupHashes',
      type: 'text',
      access: { read: () => false, update: () => false, create: () => false },
      admin: { hidden: true, readOnly: true },
    },
    {
      // The language this person sees the admin in. Automatic (null or 'auto')
      // follows the browser; see src/features/uiStrings/locales.ts. Each user
      // may set their own; an admin may set anyone's from the Users edit screen.
      name: 'adminLanguage',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { label: 'Automatic (match browser)', value: 'auto' },
        ...ADMIN_UI_LOCALES.map((code) => ({ label: `${ADMIN_UI_LOCALE_LABELS[code].native} (${ADMIN_UI_LOCALE_LABELS[code].label})`, value: code })),
      ],
      admin: {
        description: 'Language of the admin screens for this account. Website languages are not affected.',
      },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['customer'],
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
        { label: 'Customer', value: 'customer' },
      ],
      access: {
        // only admins can change roles
        update: ({ req }) => Boolean(req.user?.roles?.includes('admin')),
      },
    },
    {
      name: 'customRole',
      type: 'relationship',
      relationTo: 'roles',
      required: false,
      access: {
        update: ({ req }) => Boolean(req.user?.roles?.includes('admin')),
      },
      admin: {
        hidden: false,
        condition: ({ user }) => Boolean(user?.roles?.includes('admin')),
      },
    },
    {
      name: 'permissionOverrides',
      type: 'json',
      access: {
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      admin: {
        description: 'Grant or deny single permissions for this user on top of their role.',
        components: {
          Field: '@/admin/components/UserPermissionOverridesField#UserPermissionOverridesField',
        },
      },
    },
  ],
  versions: false,
}
