/**
 * Letting the embed page - and only the embed page - be shown in another
 * website's iframe.
 *
 * Every other path keeps the site-wide `X-Frame-Options` (usually SAMEORIGIN)
 * untouched; this is applied to an embed page alone: /embed/<key> (the hosted
 * page of one embed) and the older /embed/forms/<key>, which shows the same
 * page. The allow-list is the embed's own, expressed as `frame-ancestors`
 * (which also covers browsers that ignore X-Frame-Options when both are
 * present, so removing the old header is safe).
 */

import { cleanEmbedOrigins, RESERVED_EMBED_KEYS } from './embeds'
import { frameAncestors } from './origin'

/** Matches an embed page address and returns the embed's key, or null. A trailing slash is allowed, nothing else is. */
export function embedPathKey(pathname: string): string | null {
  const legacy = /^\/embed\/forms\/([A-Za-z0-9_-]{1,60})\/?$/.exec(pathname)
  if (legacy) return legacy[1]
  const hosted = /^\/embed\/([A-Za-z0-9_-]{1,60})\/?$/.exec(pathname)
  if (hosted && !RESERVED_EMBED_KEYS.has(hosted[1])) return hosted[1]
  return null
}

export type EmbedFrameDecision =
  | { frameable: false }
  | { frameable: true; contentSecurityPolicy: string }

/** From one embed's switch and websites, and the status of its form. Pure. */
export function decideEmbedFrame(input: { enabled: boolean; allowedOrigins: unknown; formStatus?: string | null } | null): EmbedFrameDecision {
  if (!input) return { frameable: false }
  if (input.formStatus === 'draft') return { frameable: false }
  if (!input.enabled) return { frameable: false }
  return { frameable: true, contentSecurityPolicy: `frame-ancestors ${frameAncestors(cleanEmbedOrigins(input.allowedOrigins))}` }
}

/**
 * Applies the decision to a response's headers. A frame-ancestors directive
 * already present in a CSP is replaced rather than duplicated.
 */
export function applyEmbedFrame(headers: Headers, decision: EmbedFrameDecision): void {
  if (!decision.frameable) return
  headers.delete('X-Frame-Options')
  const directive = decision.contentSecurityPolicy
  const current = headers.get('Content-Security-Policy')
  if (!current) {
    headers.set('Content-Security-Policy', directive)
    return
  }
  const without = current
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !/^frame-ancestors\b/i.test(part))
  headers.set('Content-Security-Policy', [...without, directive].join('; '))
}
