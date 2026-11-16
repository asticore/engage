// @vitest-environment node
// Username sign-in (Task 23g): the rules, the lookup and the profile write, against a stand-in engine.
import { describe, expect, it } from 'vitest'

import {
  RESERVED_USERNAMES,
  emailForUsername,
  looksLikeUsername,
  normalizeUsername,
  usernameProblem,
} from '@/features/accounts/username'
import { changeUsername } from '@/features/accounts/profile'
import { describeAuthMethods, togglePatch } from '@/features/security/authMethods'
import { DEFAULT_SECURITY_SETTINGS, usernameSignInFrom } from '@/features/security/settings'
import { emptySocialConfig } from '@/features/socialLogin/providers'

type Row = { id: number; email: string; username?: string | null }

const makeEngine = (rows: Row[]) => ({
  rows,
  find: async ({ where }: { where: Record<string, { equals: unknown }> }) => {
    const [[field, cond]] = Object.entries(where)
    return { docs: rows.filter((r) => (r as Record<string, unknown>)[field] === cond.equals) }
  },
  update: async ({ id, data }: { id: number; data: { username: string | null } }) => {
    const taken = data.username && rows.some((r) => r.id !== id && r.username === data.username)
    if (taken) throw new Error('duplicate')
    Object.assign(rows.find((r) => r.id === id) as Row, data)
    return rows.find((r) => r.id === id)
  },
})

describe('username rules', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  Ada_Lovelace ')).toBe('ada_lovelace')
    expect(normalizeUsername(undefined)).toBe('')
  })

  it('accepts 3 to 32 of letters, digits, underscore and dash', () => {
    expect(usernameProblem('abc')).toBeNull()
    expect(usernameProblem('a-b_9')).toBeNull()
    expect(usernameProblem('x'.repeat(32))).toBeNull()
  })

  it('refuses too short, too long, bad characters and reserved words', () => {
    expect(usernameProblem('ab')).toMatch(/3 to 32/)
    expect(usernameProblem('x'.repeat(33))).toMatch(/3 to 32/)
    expect(usernameProblem('no spaces')).toMatch(/letters, digits/)
    expect(usernameProblem('a@b')).toMatch(/letters, digits/)
    for (const word of RESERVED_USERNAMES) expect(usernameProblem(word), word).toBeTruthy()
  })

  it('treats an entry without @ as a username', () => {
    expect(looksLikeUsername('ada')).toBe(true)
    expect(looksLikeUsername('ada@example.com')).toBe(false)
    expect(looksLikeUsername('  ')).toBe(false)
  })
})

describe('username lookup', () => {
  const engine = makeEngine([{ id: 1, email: 'Ada@Example.com', username: 'ada_l' }])

  it('finds the email case-insensitively', async () => {
    expect(await emailForUsername(engine as never, 'ADA_L')).toBe('ada@example.com')
  })

  it('answers null for an unknown or invalid username, the same as a wrong password path', async () => {
    expect(await emailForUsername(engine as never, 'nobody')).toBeNull()
    expect(await emailForUsername(engine as never, 'a b')).toBeNull()
    expect(await emailForUsername(engine as never, 'admin')).toBeNull()
  })
})

describe('changeUsername', () => {
  const user = { id: 1, email: 'a@b.co' }

  it('saves a normalized username and clears it when empty', async () => {
    const engine = makeEngine([{ id: 1, email: 'a@b.co' }])
    expect((await changeUsername(engine as never, user as never, ' Ada_L ')).ok).toBe(true)
    expect(engine.rows[0].username).toBe('ada_l')
    expect((await changeUsername(engine as never, user as never, '')).ok).toBe(true)
    expect(engine.rows[0].username).toBeNull()
  })

  it('refuses an invalid name before writing', async () => {
    const engine = makeEngine([{ id: 1, email: 'a@b.co' }])
    const result = await changeUsername(engine as never, user as never, 'admin')
    expect(result.ok).toBe(false)
    expect(engine.rows[0].username).toBeUndefined()
  })

  it('gives a taken name the same wording as an unusable one', async () => {
    const engine = makeEngine([
      { id: 1, email: 'a@b.co' },
      { id: 2, email: 'c@d.co', username: 'taken' },
    ])
    const result = await changeUsername(engine as never, user as never, 'taken')
    expect(result).toEqual({ ok: false, message: 'That username cannot be used.' })
  })
})

describe('username sign-in setting', () => {
  it('is off by default and read from its column', () => {
    expect(DEFAULT_SECURITY_SETTINGS.usernameSignIn.enabled).toBe(false)
    expect(usernameSignInFrom(() => undefined).enabled).toBe(false)
    expect(usernameSignInFrom((k) => (k === 'username_sign_in_enabled' ? 1 : undefined)).enabled).toBe(true)
  })

  it('has a switch on the Authentication overview', () => {
    const rows = describeAuthMethods(DEFAULT_SECURITY_SETTINGS as never, emptySocialConfig())
    expect(rows.find((r) => r.id === 'username')).toMatchObject({ status: 'off', toggle: true })
    expect(togglePatch('username', true)).toEqual({ usernameSignInEnabled: true })
  })
})
