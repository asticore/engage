import type { GlobalAfterChangeHook } from '@/engine'

// The audit and settings modules load on demand: the globals that use this hook are imported by those modules' own config.

/**
 * Sensitive settings: the ones whose change can lock admins out or open the site
 * to someone new. Changing them is NOT blocked by a second confirmation (a
 * single-admin site would be locked out). Instead every change is written to the
 * audit log with the old and new values, and every admin is emailed a notice with
 * who changed it and when.
 */

type Watch = {
  /** Field name on the global's document. */
  key: string
  label: string
  /** Reduces the stored value to the part that matters, so row ids and timestamps do not count as changes. */
  pick?: (value: unknown) => unknown
}

export const SECURITY_SENSITIVE_FIELDS: Watch[] = [
  { key: 'adminPath', label: 'Admin URL' },
  { key: 'allowPasswordlessForAdmins', label: 'Passwordless sign-in for admins' },
  { key: 'passkeysAllowAdmins', label: 'Passkeys for admins' },
  { key: 'requireTwoFactorForAdmins', label: 'Two-factor required for admins' },
  { key: 'requireTwoFactorForMembers', label: 'Two-factor required for customers' },
  { key: 'twoFactorRequiredRoles', label: 'Roles that must use two-factor' },
  { key: 'twoFactorGraceEndsAt', label: 'Two-factor grace period end' },
  { key: 'twoFactorEmailOtpEnabled', label: 'Email codes as a second factor' },
]

export const DOMAIN_SENSITIVE_FIELDS: Watch[] = [
  {
    key: 'domains',
    label: 'Domains and admin access',
    pick: (value) =>
      Array.isArray(value)
        ? value.map((row) => {
            const r = (row ?? {}) as Record<string, unknown>
            return { host: r.host ?? null, allowAdmin: r.allowAdmin ?? null, isPrimary: r.isPrimary ?? null, redirectToPrimary: r.redirectToPrimary ?? null }
          })
        : null,
  },
]

export type SensitiveChange = { label: string; before: string; after: string }

const MAX_SHOWN = 160

const show = (value: unknown): string => {
  const text = value === undefined || value === null ? 'not set' : JSON.stringify(value)
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN)}...` : text
}

/** The watched fields whose value differs between the saved document and the one being saved. Pure. */
export function sensitiveChanges(
  watch: readonly Watch[],
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): SensitiveChange[] {
  const changes: SensitiveChange[] = []
  for (const { key, label, pick } of watch) {
    const reduce = pick ?? ((value: unknown) => value ?? null)
    const before = reduce(previous?.[key])
    const after = reduce(next?.[key])
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) continue
    changes.push({ label, before: show(before), after: show(after) })
  }
  return changes
}

/** Every admin account's address (role `admin`). Paged, bounded, and never throws. */
async function adminEmails(engine: unknown): Promise<string[]> {
  const emails = new Set<string>()
  const find = (engine as { find?: (args: Record<string, unknown>) => Promise<{ docs: Array<Record<string, unknown>> }> }).find
  if (!find) return []
  const limit = 100
  for (let page = 1; page <= 20; page++) {
    const result = await find({ collection: 'users', limit, page, depth: 0, overrideAccess: true })
    for (const user of result.docs) {
      const roles = Array.isArray(user.roles) ? (user.roles as unknown[]) : []
      if (roles.includes('admin') && typeof user.email === 'string' && user.email) emails.add(user.email)
    }
    if (result.docs.length < limit) break
  }
  return [...emails]
}

/**
 * Global afterChange hook: audit-logs and emails all admins when a watched
 * field changed. Never fails the save: a log or email problem is swallowed.
 */
export function sensitiveSettingsAfterChange(globalSlug: string, watch: readonly Watch[]): GlobalAfterChangeHook {
  return async ({ doc, previousDoc, req }) => {
    try {
      const changes = sensitiveChanges(watch, previousDoc as Record<string, unknown>, doc as Record<string, unknown>)
      if (changes.length === 0) return doc
      const request = req as unknown as { engine?: unknown; user?: { id?: number | string; email?: string } | null; headers?: Headers }
      if (!request.engine) return doc

      const who = request.user?.email ?? 'an admin'
      const when = new Date().toISOString()
      const { audit, auditContext, impersonatorTag } = await import('./auditLog')
      const { getSecuritySettings } = await import('./settings')
      const settings = await getSecuritySettings(request.engine as Parameters<typeof getSecuritySettings>[0])
      const tag = await impersonatorTag(request.headers?.get('cookie'), request.user?.id)
      const context = request.headers ? auditContext(new Request('https://engage.local', { headers: request.headers })) : {}
      await audit(
        {
          action: 'settings.update',
          collectionSlug: globalSlug,
          actorId: request.user?.id ?? null,
          actorEmail: request.user?.email ?? null,
          ...context,
          ...(tag ?? {}),
          detail: `Sensitive: ${changes.map((c) => `${c.label} ${c.before} -> ${c.after}`).join('; ')}`,
        },
        settings,
      )

      const to = await adminEmails(request.engine)
      if (to.length > 0) {
        const { sendEmail } = await import('@/features/email')
        await sendEmail({
          to,
          subject: `Security change on this site: ${changes.map((c) => c.label).join(', ')}`,
          template: 'security.sensitive-change',
          text: [
            `${who} changed sensitive settings at ${when}.`,
            '',
            ...changes.map((c) => `- ${c.label}: ${c.before} -> ${c.after}`),
            '',
            'If you did not expect this, sign in and check Security and the audit log straight away.',
          ].join('\n'),
        })
      }
    } catch {
      // Recording and notifying must never be able to fail the save.
    }
    return doc
  }
}
