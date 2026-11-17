/**
 * The script nonce for the current request (CSP builder, script nonces), or undefined when the builder is not using
 * nonces. Server components put it on their own inline scripts: `<script nonce={await requestNonce()} ...>`.
 * Never throws: outside a request (a build, a test) there is simply no nonce.
 */
export async function requestNonce(): Promise<string | undefined> {
  try {
    const { headers } = await import('next/headers')
    return (await headers()).get('x-nonce') || undefined
  } catch {
    return undefined
  }
}
