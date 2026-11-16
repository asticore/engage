/** SHA-256 of a file's bytes as lowercase hex, used to spot the same file uploaded twice. */
export async function contentHash(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
