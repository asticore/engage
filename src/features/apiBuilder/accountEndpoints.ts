import { intersectScopes } from '@/features/apiKeys/categories'
import { isStaffRoles, scopesAllow } from '@/features/apiKeys/core'
import type { ApiEndpoint, RequiredRole } from './core'

const ROLE_OK: Record<RequiredRole, (roles: readonly string[]) => boolean> = {
  any: () => true,
  staff: (roles) => isStaffRoles(roles),
  editor: (roles) => roles.includes('admin') || roles.includes('editor'),
  admin: (roles) => roles.includes('admin'),
}

/** Pure: the endpoints one account may use. `categoryScopes` null means no category governs the account. */
export function endpointsForAccount(
  endpoints: readonly ApiEndpoint[],
  account: { roles: readonly string[]; categoryId: number | null; categoryScopes: readonly string[] | null },
): ApiEndpoint[] {
  return endpoints.filter((e) => {
    if (!e.enabled) return false
    if (e.allowedCategoryIds && e.allowedCategoryIds.length > 0 && !(account.categoryId !== null && e.allowedCategoryIds.includes(account.categoryId))) return false
    if (!ROLE_OK[e.requiredRole](account.roles)) return false
    if (account.categoryScopes && !scopesAllow(intersectScopes(['*'], account.categoryScopes), e.collection, 'read')) return false
    return true
  })
}
