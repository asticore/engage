import type { CollectionBeforeChangeHook } from '@/engine'

import { authCaptchaRefusal, captchaFormFrom } from './authCaptcha'

/**
 * The CAPTCHA on the public RSVP form (place "rsvp"). The form posts to the collection's REST endpoint, so the check is
 * a before-change hook on create: it only looks at requests that come from the web (they carry headers) and are not
 * signed in staff, and never at an RSVP made for a paid order. The token travels in the `x-cf-turnstile-response` or
 * `x-g-recaptcha-response` header, because a field the collection does not know would be dropped from the body.
 */
export const checkRsvpCaptcha: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create' || data?.orderId) return data
  const headers = (req as unknown as { headers?: { get(name: string): string | null } }).headers
  if (!headers || typeof headers.get !== 'function' || (req as unknown as { user?: unknown }).user) return data
  const refused = await authCaptchaRefusal(req.engine as never, captchaFormFrom(null, headers), headers.get('cf-connecting-ip') ?? undefined, 'rsvp')
  if (refused) throw new Error(refused)
  return data
}
