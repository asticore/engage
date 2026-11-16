import { CONSENT_COOKIE_NAME, parseRecord, readCookie } from '@/features/consent/consent'

import type { ConsentCategory } from './core'

/**
 * True when the referral cookie may be stored. A site can file it under Necessary (always allowed) or under
 * Preferences, Analytics or Marketing, in which case the visitor must have switched that category on in the cookie banner.
 * No answer yet counts as refused.
 */
export function referralAllowed(category: ConsentCategory, cookieHeader: string | null | undefined): boolean {
  if (category === 'necessary') return true
  const record = parseRecord(readCookie(cookieHeader, CONSENT_COOKIE_NAME))
  return record?.c[category] === true
}
