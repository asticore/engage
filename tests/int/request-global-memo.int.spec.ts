import { describe, expect, it, vi } from 'vitest'

import { clearGlobalMemo, memoGlobalRead } from '@/localapi/requestGlobalMemo'

describe('memoGlobalRead', () => {
  it('always loads outside a React render and never shares without a key', async () => {
    const load = vi.fn(async () => ({ a: 1 }))
    await memoGlobalRead('k', load)
    await memoGlobalRead('k', load)
    await memoGlobalRead(null, load)
    expect(load).toHaveBeenCalledTimes(3)
  })
  it('clearGlobalMemo is safe to call anywhere', () => {
    expect(() => clearGlobalMemo()).not.toThrow()
  })
})
