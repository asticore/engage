/** Pure outbound link helpers (Task 31d). No server imports, so the storefront view builder can use them anywhere. */

export const GO_PATH = '/go'

/** The address the Buy button points at: the cloaked short link when cloaking is on, else the real address. */
export function outboundHref(productId: number | null | undefined, url: string, cloak = true, source = 'product'): string {
  if (!cloak || typeof productId !== 'number' || !Number.isInteger(productId) || productId < 1) return url
  return `${GO_PATH}/${productId}?s=${encodeURIComponent(source)}`
}

/** A click source label: lower case letters, digits and - _ / . only, at most 60 characters. Falls back to "direct". */
export function cleanSource(raw: string | null | undefined): string {
  const value = (raw ?? '').toLowerCase().replace(/[^a-z0-9/_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return value || 'direct'
}

/** The source of a click: the `s` parameter, else the path of the page it came from on this site, else "direct". */
export function sourceOf(param: string | null, referer: string | null, host: string | null): string {
  if (param) return cleanSource(param)
  try {
    const ref = new URL(referer ?? '')
    if (host && ref.host === host) return cleanSource(ref.pathname)
  } catch {
    /* no usable referer */
  }
  return 'direct'
}
