
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { recordAuthEvent } from '@/features/security/authAudit'

import { guardAttempt } from './rateLimit'
import { accountContext, clearSessionCookie, currentSessionToken, requestAddress, requestClient, setSessionCookie } from './session'
import { canPark, switchTo, whoOwnsToken, withTokenParked } from './switcher'

const toAccount = '/account'

/** Switches to another account already signed in in this browser. The id is the parked session's, never an account id. */
export async function switchAccountAction(form: FormData): Promise<void> {
  const context = await accountContext()
  if (!context.flags.accounts) return redirect(toAccount)

  const guard = await guardAttempt(context.engine, 'switch-account', await requestAddress())
  if (!guard.allowed) return redirect(toAccount)

  const id = form.get('id')
  const result = await switchTo(context.engine, await currentSessionToken(), typeof id === 'string' ? id : '')
  if (!result.ok || !result.token) return redirect(toAccount)

  await setSessionCookie(result.token)
  const who = await whoOwnsToken(context.engine, result.token)
  await recordAuthEvent(context.engine, { action: 'login.success', actorId: who ? Number(who.userId) : null, actorEmail: who?.email ?? null, detail: 'switched account' }, await requestClient())
  revalidatePath('/account', 'layout')
  redirect(toAccount)
}

/** Parks the current account and opens the sign-in screen to add another. Admins are never parked: they just sign out. */
export async function addAccountAction(): Promise<void> {
  const context = await accountContext()
  if (!context.flags.accounts) return redirect(toAccount)
  const token = await currentSessionToken()
  const who = token ? await whoOwnsToken(context.engine, token) : null
  if (token && who && canPark(who.roles)) {
    await withTokenParked(token)
  } else if (token) {
    // Not parked (an admin, or no signing secret): end it properly instead of leaving a live token behind.
    await context.engine.logout({ collection: 'users', headers: await headers() }).catch((): undefined => undefined)
  }
  await clearSessionCookie()
  redirect('/account/sign-in')
}
