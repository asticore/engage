import { FEATURE_MAP } from '@/features/registry'

import { parseRetryDays } from './dunning'
import { DEFAULT_MEMBER_SETTINGS, type MemberSettings, type TeaserMode } from './types'
import { MEMBER_SETTINGS_SLUG } from './slugs'

/**
 * Reads the Members screen and folds in the feature flag.
 *
 * The engine is passed in rather than imported, for the same reason the Forms
 * feature does it: the config imports these collections, so importing
 * `@/lib/engine` here would make the config depend on itself and the
 * collections would come back undefined at boot.
 */
export type EngineLike = {
  findGlobal(args: { slug: string; depth?: number }): Promise<unknown>
}

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

const TEASERS: TeaserMode[] = ['full-hide', 'excerpt', 'blur']

const teaser = (value: unknown): TeaserMode => {
  const found = TEASERS.find((mode) => mode === value)
  return found ?? DEFAULT_MEMBER_SETTINGS.access.teaserMode
}

/** True when Members is switched on in Site Settings. */
export const membersEnabled = async (engine: EngineLike): Promise<boolean> => {
  const fallback = FEATURE_MAP.members?.defaultEnabled ?? false
  const settings = (await engine
    .findGlobal({ slug: 'site-settings', depth: 0 })
    .catch((): null => null)) as { features?: { members?: boolean | null } } | null
  return Boolean(settings?.features?.members ?? fallback)
}

type SettingsDoc = {
  registration?: { allowSignup?: boolean; requireEmailVerification?: boolean; blockDisposableEmail?: boolean; blockDisposableCustomers?: boolean; blockDisposableForms?: boolean; blockDisposableCheckout?: boolean; defaultTier?: string }
  access?: { redirectAfterLogin?: string; membersOnlyRedirect?: string; teaserMode?: string }
  billing?: { currency?: string; allowCancellation?: boolean; proration?: boolean; dunningRetryDays?: string; dunningGraceDays?: number; dunningEndAction?: string }
  emails?: { welcomeSubject?: string; welcomeBody?: string; expiryReminderDays?: number; dunningFailedSubject?: string; dunningFailedBody?: string; dunningRetrySubject?: string; dunningRetryBody?: string; dunningEndedSubject?: string; dunningEndedBody?: string; dunningDowngradedSubject?: string; dunningDowngradedBody?: string; dunningRecoveredSubject?: string; dunningRecoveredBody?: string }
}

/**
 * Never throws. An unreadable settings global degrades to the shipped defaults
 * with the feature OFF, which fails closed: nothing is unlocked by a settings
 * read that went wrong, and nobody is charged either.
 */
export const getMemberSettings = async (engine: EngineLike): Promise<MemberSettings> => {
  const base = DEFAULT_MEMBER_SETTINGS

  const enabled = await membersEnabled(engine).catch((): boolean => false)

  const doc = (await engine
    .findGlobal({ slug: MEMBER_SETTINGS_SLUG, depth: 0 })
    .catch((): null => null)) as SettingsDoc | null

  if (!doc) return { ...base, featureEnabled: enabled }

  return {
    featureEnabled: enabled,
    registration: {
      allowSignup: bool(doc.registration?.allowSignup, base.registration.allowSignup),
      requireEmailVerification: bool(
        doc.registration?.requireEmailVerification,
        base.registration.requireEmailVerification,
      ),
      blockDisposableEmail: bool(doc.registration?.blockDisposableEmail, base.registration.blockDisposableEmail),
      blockDisposableCustomers: bool(doc.registration?.blockDisposableCustomers, base.registration.blockDisposableCustomers),
      blockDisposableForms: bool(doc.registration?.blockDisposableForms, base.registration.blockDisposableForms),
      blockDisposableCheckout: bool(doc.registration?.blockDisposableCheckout, base.registration.blockDisposableCheckout),
      defaultTier: text(doc.registration?.defaultTier, ''),
    },
    access: {
      redirectAfterLogin: text(doc.access?.redirectAfterLogin, base.access.redirectAfterLogin),
      membersOnlyRedirect: text(doc.access?.membersOnlyRedirect, base.access.membersOnlyRedirect),
      teaserMode: teaser(doc.access?.teaserMode),
    },
    billing: {
      currency: text(doc.billing?.currency, base.billing.currency),
      allowCancellation: bool(doc.billing?.allowCancellation, base.billing.allowCancellation),
      proration: bool(doc.billing?.proration, base.billing.proration),
      dunningRetryDays: typeof doc.billing?.dunningRetryDays === 'string' ? parseRetryDays(doc.billing.dunningRetryDays) : base.billing.dunningRetryDays,
      dunningGraceDays: num(doc.billing?.dunningGraceDays, base.billing.dunningGraceDays),
      dunningEndAction: doc.billing?.dunningEndAction === 'free-tier' ? 'free-tier' : 'expire',
    },
    emails: {
      welcomeSubject: text(doc.emails?.welcomeSubject, base.emails.welcomeSubject),
      welcomeBody: text(doc.emails?.welcomeBody, ''),
      expiryReminderDays: num(doc.emails?.expiryReminderDays, base.emails.expiryReminderDays),
      dunningFailedSubject: text(doc.emails?.dunningFailedSubject, ''),
      dunningFailedBody: text(doc.emails?.dunningFailedBody, ''),
      dunningRetrySubject: text(doc.emails?.dunningRetrySubject, ''),
      dunningRetryBody: text(doc.emails?.dunningRetryBody, ''),
      dunningEndedSubject: text(doc.emails?.dunningEndedSubject, ''),
      dunningEndedBody: text(doc.emails?.dunningEndedBody, ''),
      dunningDowngradedSubject: text(doc.emails?.dunningDowngradedSubject, ''),
      dunningDowngradedBody: text(doc.emails?.dunningDowngradedBody, ''),
      dunningRecoveredSubject: text(doc.emails?.dunningRecoveredSubject, ''),
      dunningRecoveredBody: text(doc.emails?.dunningRecoveredBody, ''),
    },
  }
}
