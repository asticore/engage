import { describe, expect, it, vi } from 'vitest'

// Inside a render React's cache() hands out one value per request: simulate that with a single shared holder.
vi.mock('react', () => ({
  cache: <T,>(fn: () => T): (() => T) => {
    let value: T | undefined
    let made = false
    return () => {
      if (!made) {
        value = fn()
        made = true
      }
      return value as T
    }
  },
}))

import { clearGlobalMemo, memoGlobalRead } from '@/localapi/requestGlobalMemo'

describe('memoGlobalRead inside a render', () => {
  it('shares one read, hands out copies, reloads after a write and after a failure', async () => {
    const load = vi.fn(async () => ({ list: [1] }))
    const [a, b] = await Promise.all([memoGlobalRead('g', load), memoGlobalRead('g', load)])
    a.list.push(2)
    expect(b.list).toEqual([1])
    expect((await memoGlobalRead('g', load)).list).toEqual([1])
    expect(load).toHaveBeenCalledTimes(1)
    clearGlobalMemo()
    await memoGlobalRead('g', load)
    expect(load).toHaveBeenCalledTimes(2)

    const failing = vi.fn(async (): Promise<number> => {
      throw new Error('boom')
    })
    await expect(memoGlobalRead('f', failing)).rejects.toThrow('boom')
    await expect(memoGlobalRead('f', failing)).rejects.toThrow('boom')
    expect(failing).toHaveBeenCalledTimes(2)
  })
  it('never shares a read without a key', async () => {
    const load = vi.fn(async () => 1)
    await memoGlobalRead(null, load)
    await memoGlobalRead(null, load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
