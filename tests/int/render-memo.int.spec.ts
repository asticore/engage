import { beforeEach, describe, expect, it, vi } from 'vitest'

let cookieNames: string[] = []
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => cookieNames.map((name) => ({ name, value: '1' })) }),
}))

import { publishEpoch } from '@/features/speed/epochState'
import { memoByEpoch, resetRenderMemo } from '@/features/speed/renderMemo'

describe('memoByEpoch', () => {
  beforeEach(() => {
    resetRenderMemo()
    publishEpoch(5)
    cookieNames = []
  })
  it('loads once per epoch for anonymous visitors and hands out copies', async () => {
    const load = vi.fn(async () => ({ rows: [1, 2] }))
    const first = await memoByEpoch('k', load)
    first.rows.push(3)
    const second = await memoByEpoch('k', load)
    expect(load).toHaveBeenCalledTimes(1)
    expect(second.rows).toEqual([1, 2])
    publishEpoch(6)
    await memoByEpoch('k', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('never memoises for signed-in or unlocked visitors', async () => {
    const load = vi.fn(async () => 1)
    cookieNames = ['engage-token']
    await memoByEpoch('k', load)
    await memoByEpoch('k', load)
    cookieNames = ['eg_unlock_p']
    await memoByEpoch('k', load)
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('does not memoise when no epoch is known', async () => {
    publishEpoch(undefined)
    const load = vi.fn(async () => 1)
    await memoByEpoch('k', load)
    await memoByEpoch('k', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
