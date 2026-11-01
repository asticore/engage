// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { allDone, connectionSetup, type SetupInput } from '@/features/tracking/connect/setup'

const empty: SetupInput = {
  engageSecretSet: false,
  meta: { appId: '', hasAppSecret: false, connected: false },
  tiktok: { appId: '', hasAppSecret: false, connected: false },
  google: { clientId: '', hasClientSecret: false, connected: false },
}

describe('connection setup checklist', () => {
  it('lists every missing piece when nothing is set', () => {
    const setup = connectionSetup(empty)
    expect(setup.meta.map((c) => [c.key, c.done])).toEqual([
      ['app-id', false],
      ['app-secret', false],
      ['engage-secret', false],
      ['sign-in', false],
    ])
    expect(setup.google.map((c) => c.key)).toEqual(['google-client', 'google-secret', 'engage-secret', 'sign-in'])
    expect(allDone(setup.tiktok)).toBe(false)
  })

  it('marks a connection ready only when app, secret, ENGAGE_SECRET and sign-in are all present', () => {
    const ready = connectionSetup({
      engageSecretSet: true,
      meta: { appId: '1234567890', hasAppSecret: true, connected: true },
      tiktok: { appId: '  ', hasAppSecret: true, connected: false },
      google: { clientId: 'client.apps.googleusercontent.com', hasClientSecret: true, connected: true },
    })
    expect(allDone(ready.meta)).toBe(true)
    expect(allDone(ready.google)).toBe(true)
    // A blank app ID does not count, even with a saved secret.
    expect(ready.tiktok.find((c) => c.key === 'app-id')?.done).toBe(false)
  })

  it('shares one ENGAGE_SECRET check across the platforms', () => {
    const setup = connectionSetup({ ...empty, engageSecretSet: true })
    expect(setup.meta.find((c) => c.key === 'engage-secret')?.done).toBe(true)
    expect(setup.tiktok.find((c) => c.key === 'engage-secret')?.done).toBe(true)
    expect(setup.google.find((c) => c.key === 'engage-secret')?.done).toBe(true)
  })
})
