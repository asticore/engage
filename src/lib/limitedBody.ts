import { NextResponse } from 'next/server'

/**
 * Reads a request body as text without ever holding more than `maxBytes`.
 * `Content-Length` is checked first, but it is only a claim: a chunked body or a
 * wrong header is not trusted, so the bytes are counted as they arrive and the
 * read stops as soon as the limit is passed.
 */
export async function readLimitedText(request: Request, maxBytes: number, tooBigMessage: string): Promise<{ text: string } | { response: Response }> {
  const tooBig = { response: NextResponse.json({ error: tooBigMessage }, { status: 413 }) }
  const header = request.headers.get('content-length')
  if (header !== null && header.trim() !== '' && Number(header) > maxBytes) return tooBig
  if (!request.body) return { text: '' }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch((): void => undefined)
      return tooBig
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    merged.set(chunk, at)
    at += chunk.byteLength
  }
  return { text: new TextDecoder('utf-8').decode(merged) }
}
