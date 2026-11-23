import { BLOG_BASE_MESSAGES, SHOP_BASE_MESSAGES, validateBlogBase, validateShopBase, normaliseBlogBase } from './permalinks'

type FieldOptions = { req?: { engine: { find: (args: Record<string, unknown>) => Promise<{ docs: unknown[] }> } } }

export const BLOG_BASE_PAGE_MESSAGE = 'A page already uses that address. Rename or unpublish the page first, or choose another blog address.'

/**
 * Field validator for the blog address on SEO settings (Task 16e). Returns true, or the message shown
 * beside the field. Checks the reserved words, the admin and sign-in addresses, and a top-level page
 * with the same address (the middleware would hide that page behind the blog).
 */
export const validateBlogBaseField =
  () =>
  async (value: unknown, options?: FieldOptions): Promise<true | string> => {
    if (value === null || value === undefined || value === '') return true
    const { getAdminRoot, getSignInPaths } = await import('@/features/security/settings')
    const signIn = await getSignInPaths()
    const error = validateBlogBase(value, { adminRoot: await getAdminRoot(), signInPaths: Object.values(signIn) })
    if (error !== null) return BLOG_BASE_MESSAGES[error]
    const core = normaliseBlogBase(value)
    if (core) {
      const { readShopBase } = await import('./permalinkStore')
      if (core === (await readShopBase().catch((): string => 'shop'))) return 'The blog address cannot be the same as the shop address.'
    }
    if (options?.req && core && core !== 'blog') {
      const { docs } = await options.req.engine
        .find({ collection: 'pages', where: { and: [{ slug: { equals: core } }, { parent: { exists: false } }] }, limit: 1, depth: 0 })
        .catch((): { docs: unknown[] } => ({ docs: [] }))
      if (docs.length > 0) return BLOG_BASE_PAGE_MESSAGE
    }
    return true
  }

export const SHOP_BASE_PAGE_MESSAGE = 'A page already uses that address. Rename or unpublish the page first, or choose another shop address.'

/** Field validator for the shop address (Task 16e): the same checks as the blog address, and it may not equal the blog address. */
export const validateShopBaseField =
  () =>
  async (value: unknown, options?: FieldOptions): Promise<true | string> => {
    if (value === null || value === undefined || value === '') return true
    const { getAdminRoot, getSignInPaths } = await import('@/features/security/settings')
    const { readBlogBase } = await import('./permalinkStore')
    const signIn = await getSignInPaths()
    const error = validateShopBase(value, { adminRoot: await getAdminRoot(), signInPaths: Object.values(signIn), blogBase: await readBlogBase().catch((): string => 'blog') })
    if (error !== null) return SHOP_BASE_MESSAGES[error]
    const core = normaliseBlogBase(value)
    if (options?.req && core && core !== 'shop') {
      const { docs } = await options.req.engine
        .find({ collection: 'pages', where: { and: [{ slug: { equals: core } }, { parent: { exists: false } }] }, limit: 1, depth: 0 })
        .catch((): { docs: unknown[] } => ({ docs: [] }))
      if (docs.length > 0) return SHOP_BASE_PAGE_MESSAGE
    }
    return true
  }
