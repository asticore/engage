import { ADMIN_PATH_ENV, resolveAdminRoot } from './adminPath'
import { DEFAULT_SIGN_IN_PATHS, SIGN_IN_PATH_MESSAGES, validateSignInPath, type SignInPlace } from './signInPath'

type PageFinder = { engine: { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> } }
type FieldOptions = { siblingData?: Record<string, unknown>; req?: PageFinder }

export const SIGN_IN_PATH_PAGE_MESSAGE = 'A page already uses that address. Rename or unpublish the page first, or choose another sign-in URL.'

/** Field validator for the customer and member sign-in URL settings. Returns true, or the message shown beside the field. */
export const validateSignInPathField =
  (place: SignInPlace, otherField: string) =>
  async (value: unknown, options?: FieldOptions): Promise<true | string> => {
    if (value === null || value === undefined || value === '') return true
    const sibling = options?.siblingData ?? {}
    const adminRoot = resolveAdminRoot(sibling.adminPath, process.env[ADMIN_PATH_ENV])
    const other = typeof sibling[otherField] === 'string' && sibling[otherField] ? String(sibling[otherField]) : undefined
    const error = validateSignInPath(value, place, { adminRoot, otherPath: other ? `/${other.trim().replace(/^\/+|\/+$/g, '')}` : undefined })
    if (error !== null) return SIGN_IN_PATH_MESSAGES[error]
    // A top-level page at the same address would be hidden behind the sign-in. Defaults are always allowed.
    const core = value.toString().trim().replace(/^\/+|\/+$/g, '')
    if (options?.req && core && `/${core}` !== DEFAULT_SIGN_IN_PATHS[place]) {
      const { docs } = await options.req.engine
        .find({ collection: 'pages', where: { and: [{ slug: { equals: core } }, { parent: { exists: false } }] }, limit: 1, depth: 0 })
        .catch((): { docs: unknown[] } => ({ docs: [] }))
      if (docs.length > 0) return SIGN_IN_PATH_PAGE_MESSAGE
    }
    return true
  }
