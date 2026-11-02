import { getAdminContext } from '@/admin/auth'

/**
 * Roles of the signed-in admin, for field group rules on a user role. Admin
 * screens and routes only: public pages never see the editor's roles.
 */
export async function editorRoles(): Promise<string[]> {
  const context = await getAdminContext()
  const roles = (context.user as { roles?: unknown } | null)?.roles
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === 'string') : []
}
