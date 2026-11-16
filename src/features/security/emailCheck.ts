/**
 * Email checks for sign-up: block throwaway (disposable) addresses and suggest a fix for a likely
 * typo in a common domain. Pure. The disposable list is a built-in set of well-known services; an
 * admin allow and deny list and a scheduled refresh are not built yet.
 */

export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz', 'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
  '10minutemail.com', '10minutemail.net', '20minutemail.com', 'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempail.com',
  'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr', 'trashmail.com', 'trashmail.net', 'trashmail.de', 'dispostable.com', 'getnada.com', 'nada.email',
  'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'mohmal.com', 'mytemp.email', 'spamgourmet.com', 'fakeinbox.com', 'getairmail.com', 'emailondeck.com',
  'discard.email', 'discardmail.com', 'burnermail.io', 'mailcatch.com', 'moakt.com', 'tmpmail.org', 'tmpmail.net', 'inboxkitten.com', 'mail.tm', 'dropmail.me',
  'fakemail.net', 'anonbox.net', 'spambox.us', 'mailforspam.com', 'tempinbox.com', 'jetable.org', 'meltmail.com', 'owlymail.com', 'luxusmail.org', 'harakirimail.com',
  'mailtemp.info', 'emltmp.com', 'tmail.ws', 'tempr.email', 'crazymailing.com', 'e4ward.com', 'incognitomail.org', 'mvrht.net', 'spamex.com', 'trbvm.com',
])

const TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotnail.com': 'hotmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yhoo.com': 'yahoo.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com',
}

export const domainOf = (email: string): string => {
  const at = email.trim().toLowerCase().lastIndexOf('@')
  return at < 0 ? '' : email.trim().toLowerCase().slice(at + 1)
}

export const isDisposable = (email: string): boolean => {
  const domain = domainOf(email)
  if (!domain) return false
  // A subdomain of a listed service counts too.
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true
  return false
}

/** The corrected address when the domain looks like a typo of a common one, else null. */
export const suggestEmail = (email: string): string | null => {
  const fix = TYPOS[domainOf(email)]
  return fix ? `${email.trim().slice(0, email.trim().lastIndexOf('@'))}@${fix}` : null
}

export type EmailVerdict = { ok: true } | { ok: false; reason: 'disposable' | 'typo'; message: string }

export function checkEmail(email: string, options: { blockDisposable: boolean }): EmailVerdict {
  if (options.blockDisposable && isDisposable(email)) return { ok: false, reason: 'disposable', message: 'Please use a permanent email address. Temporary email services cannot be used here.' }
  return { ok: true }
}
