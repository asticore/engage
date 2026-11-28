import type { Engine } from '@/localapi/engine'

/**
 * The start login a brand-new install ships with, so the owner can sign in straight away instead of
 * hunting for a "create account" screen. It is only created on a fresh database (no users at all), and
 * the admin sends whoever signs in with it to their own profile until the email is changed.
 * Anyone who reaches /admin first can use it, so the README tells owners to change it immediately.
 */
export const DEFAULT_ADMIN_EMAIL = 'example@example.com'
export const DEFAULT_ADMIN_PASSWORD = 'admin'

export const isDefaultAdminEmail = (email: unknown): boolean => typeof email === 'string' && email.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL

export async function seedDefaultAdmin(engine: Engine): Promise<void> {
  const { totalDocs } = await engine.find({ collection: 'users', overrideAccess: true, limit: 1, depth: 0 })
  if (totalDocs > 0) return
  await engine.create({
    collection: 'users',
    overrideAccess: true,
    data: { email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD, roles: ['admin'] } as never,
  })
  engine.logger.info('[seed] Created the start admin login.')
}
