import { ENFORCED_MESSAGE, enforcingConnection, type SsoConnection } from './core'

/**
 * True when this address must sign in through single sign-on and so may not use a password. Staff accounts
 * (admin, editor, viewer) are never blocked, so a broken identity provider can never lock the owners out.
 */
export async function passwordBlockedBySso(args: {
  email: string
  featureOn: () => Promise<boolean>
  listConnections: () => Promise<SsoConnection[]>
  rolesOf: (email: string) => Promise<string[] | null>
}): Promise<boolean> {
  const email = args.email.trim().toLowerCase()
  if (!email || !email.includes('@')) return false
  if (!(await args.featureOn())) return false
  const conn = enforcingConnection(await args.listConnections(), email)
  if (!conn) return false
  const roles = (await args.rolesOf(email)) ?? []
  return !roles.some((r) => r === 'admin' || r === 'editor' || r === 'viewer')
}

export const ssoRefusal = (): Response => Response.json({ errors: [{ name: 'SsoRequired', message: ENFORCED_MESSAGE }] }, { status: 403 })
