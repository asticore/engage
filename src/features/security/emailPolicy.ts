import { checkEmail } from './emailCheck'

/**
 * Where the disposable-email block applies beyond member sign-up: customer accounts, forms and checkout.
 * Each surface has its own switch in Members settings. Reads the setting fresh, and fails open: if the
 * setting cannot be read, nothing is blocked.
 */

export type EmailSurface = 'customers' | 'forms' | 'checkout'

type SettingsEngine = { findGlobal: (args: { slug: string; depth: number; overrideAccess?: boolean }) => Promise<unknown> }

export async function disposableRefusal(engine: unknown, surface: EmailSurface, email: string): Promise<string | null> {
  try {
    const doc = (await (engine as SettingsEngine).findGlobal({ slug: 'member-settings', depth: 0, overrideAccess: true })) as { registration?: Record<string, unknown> } | null
    const key = surface === 'customers' ? 'blockDisposableCustomers' : surface === 'forms' ? 'blockDisposableForms' : 'blockDisposableCheckout'
    if (doc?.registration?.[key] !== true) return null
    const verdict = checkEmail(email, { blockDisposable: true })
    return verdict.ok === false ? verdict.message : null
  } catch {
    return null
  }
}
