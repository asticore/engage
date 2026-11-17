import { ADMIN_PATH_ENV, resolveAdminRoot } from './adminPath'
import { SIGN_IN_PATH_MESSAGES, validateSignInPath, type SignInPlace } from './signInPath'

type FieldOptions = { siblingData?: Record<string, unknown> }

/** Field validator for the customer and member sign-in URL settings. Returns true, or the message shown beside the field. */
export const validateSignInPathField =
  (place: SignInPlace, otherField: string) =>
  (value: unknown, options?: FieldOptions): true | string => {
    if (value === null || value === undefined || value === '') return true
    const sibling = options?.siblingData ?? {}
    const adminRoot = resolveAdminRoot(sibling.adminPath, process.env[ADMIN_PATH_ENV])
    const other = typeof sibling[otherField] === 'string' && sibling[otherField] ? String(sibling[otherField]) : undefined
    const error = validateSignInPath(value, place, { adminRoot, otherPath: other ? `/${other.trim().replace(/^\/+|\/+$/g, '')}` : undefined })
    return error === null ? true : SIGN_IN_PATH_MESSAGES[error]
  }
