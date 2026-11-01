// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readLimitedForm } from '@/features/media/readBody'

const MB = 1024 * 1024

async function chunkedRequest(bytes: number, headers: Record<string, string> = {}): Promise<Request> {
  const form = new FormData()
  form.append('file', new File([new Uint8Array(bytes)], 'a.bin', { type: 'application/octet-stream' }))
  // Encode the multipart body up front, then send it from a plain stream with no Content-Length.
  // A plain stream (not undici's FormData encoder) can be cancelled without an unhandled
  // "ReadableStream is already closed" rejection on Node 24.
  const encoded = new Response(form)
  const type = encoded.headers.get('content-type') ?? ''
  const data = new Uint8Array(await encoded.arrayBuffer())
  const CHUNK = 64 * 1024
  let at = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= data.byteLength) {
        controller.close()
        return
      }
      controller.enqueue(data.subarray(at, at + CHUNK))
      at += CHUNK
    },
  })
  return new Request('http://localhost/x', { method: 'POST', body, headers: { 'content-type': type, ...headers }, duplex: 'half' } as RequestInit)
}

describe('readLimitedForm', () => {
  it('refuses on a declared Content-Length over the limit', async () => {
    const r = await readLimitedForm(await chunkedRequest(10, { 'content-length': String(500 * MB) }), 1 * MB)
    expect('response' in r && r.response.status).toBe(413)
  })

  it('refuses an oversized body that declares no Content-Length (stream cut off at the limit)', async () => {
    const source = await chunkedRequest(3 * MB)
    expect(source.headers.get('content-length')).toBeNull()
    const r = await readLimitedForm(source, 1 * MB)
    expect('response' in r && r.response.status).toBe(413)
  })

  it('accepts a small body without Content-Length and returns the form', async () => {
    const r = await readLimitedForm(await chunkedRequest(100), 1 * MB)
    expect('form' in r).toBe(true)
    if ('form' in r) expect((r.form.get('file') as File).size).toBe(100)
  })

  it('answers 400 for a missing body', async () => {
    const r = await readLimitedForm(new Request('http://localhost/x', { method: 'POST' }), 1 * MB)
    expect('response' in r && r.response.status).toBe(400)
  })
})
