import type { D1Like } from './store'
import { viewerMayRead } from './visibility'

/**
 * Gated downloads: a media file limited to a company (same table as pages and posts, collection `media`) is only
 * served to a signed-in member of that company (narrowed by the same grants), or an admin. Everyone else gets 403,
 * or 401 when not signed in. The link itself does not change, so a file that is switched to company only keeps
 * working for the people who may see it. Fails closed: a lookup error on a restricted file refuses it.
 */

export type MediaGateDecision = { allow: true; restricted: boolean } | { allow: false; status: 401 | 403 }

/** The media row for this file name when it is limited to a company, else null. A missing table (no companies set up) means unrestricted. */
export async function restrictedMediaId(d1: D1Like, filename: string): Promise<number | null> {
  try {
    const row = (await d1
      .prepare("SELECT m.id AS id FROM `eg_media` m JOIN `eg_content_org_visibility` v ON v.doc_id = m.id AND v.collection = 'media' WHERE m.filename = ? LIMIT 1")
      .bind(filename)
      .first()) as { id: number | string } | null
    return row ? Number(row.id) : null
  } catch {
    return null
  }
}

export async function decideMediaAccess(d1: D1Like, filename: string, viewer: { userId: number | null; isAdmin: boolean }): Promise<MediaGateDecision> {
  const id = await restrictedMediaId(d1, filename)
  if (id === null) return { allow: true, restricted: false }
  if (viewer.isAdmin) return { allow: true, restricted: true }
  if (viewer.userId === null) return { allow: false, status: 401 }
  try {
    return (await viewerMayRead(d1, 'media', id, viewer.userId)) ? { allow: true, restricted: true } : { allow: false, status: 403 }
  } catch {
    return { allow: false, status: 403 }
  }
}

/** True when the request comes from a browser navigation (a link or address bar), not a script fetch or an image tag. */
export function isBrowserNavigation(accept: string | null): boolean {
  return Boolean(accept && /\btext\/html\b/i.test(accept))
}

/** Where a signed out browser is sent to sign in and then come back to the file. Same path is only ever a site path. */
export function mediaSignInRedirect(pathAndQuery: string): string {
  const back = pathAndQuery.startsWith('/') && !pathAndQuery.startsWith('//') ? pathAndQuery : '/'
  return `/account/sign-in?redirect=${encodeURIComponent(back)}`
}
