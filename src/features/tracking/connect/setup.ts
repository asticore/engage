/**
 * The setup checklist shown at the top of the Tracking connections screen: which
 * pieces are missing for each connection. Pure, so it runs without the database.
 * It reports presence only (saved or not), never a value, and it is built from the
 * non-secret status plus one boolean for ENGAGE_SECRET.
 */

export type SetupCheckKey = 'app-id' | 'app-secret' | 'google-client' | 'google-secret' | 'engage-secret' | 'sign-in'

export type SetupCheck = { key: SetupCheckKey; done: boolean }

export type SetupInput = {
  /** True when ENGAGE_SECRET is set on the server. The value itself is never read here. */
  engageSecretSet: boolean
  meta: { appId: string; hasAppSecret: boolean; connected: boolean }
  tiktok: { appId: string; hasAppSecret: boolean; connected: boolean }
  google: { clientId: string; hasClientSecret: boolean; connected: boolean }
}

export type ConnectionSetup = {
  meta: SetupCheck[]
  tiktok: SetupCheck[]
  google: SetupCheck[]
}

/** The checks for each connection, in the order the screen shows them. */
export function connectionSetup(input: SetupInput): ConnectionSetup {
  const engage: SetupCheck = { key: 'engage-secret', done: input.engageSecretSet }
  const app = (side: SetupInput['meta']): SetupCheck[] => [
    { key: 'app-id', done: side.appId.trim() !== '' },
    { key: 'app-secret', done: side.hasAppSecret },
    engage,
    { key: 'sign-in', done: side.connected },
  ]
  return {
    meta: app(input.meta),
    tiktok: app(input.tiktok),
    google: [
      { key: 'google-client', done: input.google.clientId.trim() !== '' },
      { key: 'google-secret', done: input.google.hasClientSecret },
      engage,
      { key: 'sign-in', done: input.google.connected },
    ],
  }
}

/** True when every check in the list is done. */
export const allDone = (checks: SetupCheck[]): boolean => checks.every((check) => check.done)
