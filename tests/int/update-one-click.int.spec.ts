import { describe, expect, it } from 'vitest'

import { applyForkUpdate, oneClickConfig } from '@/features/updates/oneClick'

const answer = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })

describe('one click update', () => {
  it('is only offered to a fork that has a token', () => {
    expect(oneClickConfig('me/engage', 'tok')).toEqual({ repo: 'me/engage', token: 'tok' })
    expect(oneClickConfig('me/engage', '')).toBeNull()
    expect(oneClickConfig(undefined, 'tok')).toBeNull()
    expect(oneClickConfig('asticore/engage', 'tok')).toBeNull()
    expect(oneClickConfig('not a repo', 'tok')).toBeNull()
  })
  it('syncs the fork and maps the answers', async () => {
    const config = { repo: 'me/engage', token: 'tok' }
    let seen: { url: string; auth: string | null; body: string } | null = null
    const spy = async (url: string, init?: RequestInit) => {
      seen = { url, auth: new Headers(init?.headers).get('Authorization'), body: String(init?.body) }
      return new Response(JSON.stringify({ merge_type: 'fast-forward' }), { status: 200 })
    }
    expect(await applyForkUpdate(config, spy)).toMatchObject({ ok: true, status: 'updated' })
    expect(seen).toEqual({ url: 'https://api.github.com/repos/me/engage/merge-upstream', auth: 'Bearer tok', body: '{"branch":"main"}' })
    expect(await applyForkUpdate(config, answer(200, { merge_type: 'none' }))).toMatchObject({ ok: true, status: 'up-to-date' })
    expect(await applyForkUpdate(config, answer(409, {}))).toMatchObject({ ok: false, status: 'conflict' })
    expect(await applyForkUpdate(config, answer(403, {}))).toMatchObject({ ok: false, status: 'refused' })
    expect(await applyForkUpdate(config, answer(500, { message: 'down' }))).toMatchObject({ ok: false, status: 'failed', message: 'down' })
    expect(await applyForkUpdate(config, async () => { throw new Error('net') })).toMatchObject({ ok: false, status: 'failed' })
    expect(await applyForkUpdate(null)).toMatchObject({ ok: false, status: 'not-configured' })
  })
})
