// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  isBlockedAddress,
  isBlockedIPv6,
  checkDeliveryTarget,
  resolveWithDoh,
} from '@/features/webhooks/outbound'
import { isSecretKey, isSecretValue, redactBody, REDACTED } from '@/features/webhooks/redact'

describe('DNS rebinding guard: addresses', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '198.18.0.1',
  ])('blocks the IPv4 address %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(['93.184.216.34', '1.1.1.1', '172.32.0.1'])('allows the public IPv4 address %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false)
  })

  it.each([
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::a9fe:a9fe',
    '2001:db8::1',
    '::127.0.0.1',
  ])('blocks the IPv6 address %s', (ip) => {
    expect(isBlockedIPv6(ip)).toBe(true)
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it('allows a public IPv6 address', () => {
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false)
  })

  it('treats anything it cannot read as blocked', () => {
    expect(isBlockedAddress('not an address')).toBe(true)
  })
})

describe('DNS rebinding guard: targets', () => {
  it('passes a host name whose answers are all public', async () => {
    const result = await checkDeliveryTarget('https://hooks.example.com/in', async () => [
      '93.184.216.34',
    ])
    expect(result).toEqual({ ok: true, addresses: ['93.184.216.34'] })
  })

  it('refuses permanently when any answer is private, even alongside a public one', async () => {
    const result = await checkDeliveryTarget('https://hooks.example.com/in', async () => [
      '93.184.216.34',
      '169.254.169.254',
    ])
    expect(result).toMatchObject({ ok: false, permanent: true })
  })

  it('retries when the name has no answer or the lookup fails', async () => {
    expect(await checkDeliveryTarget('https://hooks.example.com/in', async () => [])).toMatchObject(
      { ok: false, permanent: false },
    )
    expect(
      await checkDeliveryTarget('https://hooks.example.com/in', async () => {
        throw new Error('down')
      }),
    ).toMatchObject({ ok: false, permanent: false })
  })

  it('checks a literal address without a lookup', async () => {
    let looked = false
    const resolve = async (): Promise<string[]> => {
      looked = true
      return []
    }
    expect(await checkDeliveryTarget('https://10.0.0.1/in', resolve)).toMatchObject({
      ok: false,
      permanent: true,
    })
    expect(looked).toBe(false)
  })
})

describe('DNS over HTTPS lookup', () => {
  const doh = (answers: Record<string, unknown>) =>
    (async (url: RequestInfo | URL) => {
      const type = new URL(String(url)).searchParams.get('type') ?? ''
      return new Response(JSON.stringify(answers[type] ?? { Status: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/dns-json' },
      })
    }) as typeof fetch

  it('collects the A and AAAA answers', async () => {
    const fetcher = doh({
      A: {
        Status: 0,
        Answer: [
          { type: 5, data: 'edge.example.net.' },
          { type: 1, data: '93.184.216.34' },
        ],
      },
      AAAA: { Status: 0, Answer: [{ type: 28, data: '2606:4700::1' }] },
    })
    expect(await resolveWithDoh('hooks.example.com', fetcher)).toEqual([
      '93.184.216.34',
      '2606:4700::1',
    ])
  })

  it('reads a name that does not exist as no answers', async () => {
    expect(
      await resolveWithDoh('nope.example.com', doh({ A: { Status: 3 }, AAAA: { Status: 3 } })),
    ).toEqual([])
  })

  it('throws when the resolver answers with an error', async () => {
    const fetcher = (async () => new Response('x', { status: 503 })) as typeof fetch
    await expect(resolveWithDoh('hooks.example.com', fetcher)).rejects.toThrow()
  })
})

describe('log redaction', () => {
  it('replaces the value under a secret-looking key, whatever its spelling', () => {
    const body = JSON.stringify({
      event: 'form.submitted',
      data: { values: { Api_Key: 'abc', passwordConfirm: 'pw', name: 'Ana' } },
    })
    const result = redactBody(body)
    expect(result.redacted).toBe(true)
    const parsed = JSON.parse(result.body)
    expect(parsed.data.values).toEqual({
      Api_Key: REDACTED,
      passwordConfirm: REDACTED,
      name: 'Ana',
    })
  })

  it('redacts nested and listed values', () => {
    const result = redactBody(
      JSON.stringify({ items: [{ authorization: 'x' }, { session: { token: 't' } }] }),
    )
    expect(JSON.parse(result.body)).toEqual({
      items: [{ authorization: REDACTED }, { session: REDACTED }],
    })
  })

  it('redacts values that look like credentials whatever their key', () => {
    expect(isSecretValue('Bearer abc.def')).toBe(true)
    expect(isSecretValue('whsec_1234567890')).toBe(true)
    expect(isSecretValue('eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl')).toBe(true)
    expect(JSON.parse(redactBody(JSON.stringify({ note: 'Bearer abc.def' })).body)).toEqual({
      note: REDACTED,
    })
  })

  it('leaves ordinary keys alone, including short words inside longer ones', () => {
    for (const key of ['shipping', 'classname', 'title', 'author', 'pinned', 'email'])
      expect(isSecretKey(key)).toBe(false)
    const body = JSON.stringify({ shipping: 'Hall 2', title: 'Hello' })
    expect(redactBody(body)).toEqual({ body, redacted: false })
  })

  it('redacts a body that is not JSON as a whole rather than keeping it', () => {
    expect(redactBody('not json password=1')).toEqual({
      body: JSON.stringify(REDACTED),
      redacted: true,
    })
  })

  it('treats an empty body as nothing to redact', () => {
    expect(redactBody('')).toEqual({ body: '', redacted: false })
  })
})
