/** Splits pasted text into PEM blocks (a certificate, or a bare public key). Anything else is ignored. Capped at 3. */
const PEM_BLOCK = /-----BEGIN (CERTIFICATE|PUBLIC KEY)-----([A-Za-z0-9+/=\s]+)-----END \1-----/g

export function parsePem(input: string): string[] {
  const out: string[] = []
  for (const m of input.matchAll(PEM_BLOCK)) {
    const body = m[2].replace(/\s+/g, '')
    if (body.length < 100) continue
    out.push(`-----BEGIN ${m[1]}-----\n${body.match(/.{1,64}/g)!.join('\n')}\n-----END ${m[1]}-----\n`)
    if (out.length >= 3) break
  }
  return out
}

