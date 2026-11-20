import { describe, expect, it } from 'vitest'

import { addTimingHeaders, envWithD1Timing, type D1Timing } from '@/features/speed/d1Timing'

const fakeDb = () => ({
  prepare: (sql: string) => ({
    sql,
    bind(..._args: unknown[]) {
      return this
    },
    all: async () => ({ results: [{ a: 1 }] as unknown[] }),
    first: async () => ({ a: 1 }),
  }),
  batch: async (s: unknown[]) => s.map(() => ({ results: [] as unknown[] })),
})

describe('D1 timing', () => {
  it('counts statements run through prepare, bind, all, first and batch', async () => {
    const timing: D1Timing = { count: 0, ms: 0 }
    const env = envWithD1Timing({ D1: fakeDb(), OTHER: 'x' }, timing) as { D1: ReturnType<typeof fakeDb>; OTHER: string }
    await env.D1.prepare('select 1').all()
    await env.D1.prepare('select 2').bind(1).first()
    await env.D1.batch([1, 2])
    expect(timing.count).toBe(3)
    expect(env.OTHER).toBe('x')
  })
  it('leaves an env without D1 alone and writes headers', () => {
    const env = { R2: 1 }
    expect(envWithD1Timing(env, { count: 0, ms: 0 })).toBe(env)
    const res = addTimingHeaders(new Response('ok'), { count: 4, ms: 12 })
    expect(res.headers.get('x-d1-count')).toBe('4')
    expect(res.headers.get('x-d1-ms')).toBe('12')
  })
})
