import type { Engine } from '@/engine'

import { methodAllowed, readMatrix } from '@/features/security/authMatrix'
import { placeHasWayIn } from '@/features/security/authMethods'
import { DEFAULT_SECURITY_SETTINGS, getSecuritySettings } from '@/features/security/settings'
import { readSocialConfig } from '@/features/socialLogin/settings'

/** The two public sign-in places. Customers use `/account/sign-in`, members `/account/member-sign-in`. */
export type SignInPlace = 'account' | 'members'

/** What the sign-in forms post in their hidden `area` field. Anything but `members` is the customer place. */
export const placeFromForm = (value: unknown): SignInPlace => (value === 'members' ? 'members' : 'account')

/**
 * Whether the password form is open on this place. The owner can block it (Authentication, Who can
 * sign in with what), but only while another way in is left, so a place can never be left with
 * nothing: if every other method is off or blocked, the password stays open whatever the setting says.
 */
export const passwordOpenFor = async (engine: Engine, place: SignInPlace): Promise<boolean> => {
  const matrix = await readMatrix()
  if (methodAllowed(matrix, place, 'password')) return true
  const settings = await getSecuritySettings(engine as never).catch((): typeof DEFAULT_SECURITY_SETTINGS => DEFAULT_SECURITY_SETTINGS)
  const social = await readSocialConfig(engine as never)
  return !placeHasWayIn(place, matrix, settings, social)
}

/** True when an emailed link or code is blocked for this place. */
export const emailedMethodBlocked = async (place: SignInPlace, method: 'magic-link' | 'email-code'): Promise<boolean> =>
  !methodAllowed(await readMatrix(), place, method)
