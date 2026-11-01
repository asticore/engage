import { getGoogleAccessToken, type GoogleEngine } from './auth'
import { requestJson } from './http'

/**
 * Tells Google about this site's sitemap (Search Console "Submit sitemap"). One PUT to
 * the Search Console API. It needs the full webmasters scope, which is why sign-in asks for
 * it: a connection made before that change only has read access and is told to reconnect.
 * Never returns tokens.
 */

const API = 'https://www.googleapis.com/webmasters/v3/sites'

/** Flat on purpose: strictNullChecks is off in this project, so a union would not narrow. */
export type SitemapResult = { ok: boolean; message?: string; status?: number; error?: string }

/** The address of the sitemap for this site, or '' when SITE_URL is not set. */
export function sitemapFeedFor(origin: string): string {
  const clean = (origin || '').trim().replace(/\/+$/, '')
  return clean ? `${clean}/sitemap.xml` : ''
}

export function sitemapSubmitUrl(site: string, feed: string): string {
  return `${API}/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(feed)}`
}

/** Submits the sitemap for a property the connected account owns. Never throws. */
export async function submitSitemap(engine: GoogleEngine, site: string, feed: string): Promise<SitemapResult> {
  try {
    const auth = await getGoogleAccessToken(engine)
    if (auth.ok === false) return { ok: false, status: 401, error: auth.message }

    const result = await requestJson(sitemapSubmitUrl(site, feed), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
    })
    if (result.ok) return { ok: true, message: `Google has the sitemap ${feed}. It can take a few days for Google to read it.` }
    if (result.status === 401 || result.status === 403) {
      return {
        ok: false,
        status: result.status,
        error: 'Google did not allow this. Reconnect Google on the Google connection page to allow sitemap submission, and check that this account owns the property.',
      }
    }
    if (result.status === 404) return { ok: false, status: 404, error: 'Google could not find this property. Choose it again on the Google connection page.' }
    return { ok: false, status: result.status, error: `Google answered with an error (status ${result.status}). Try again later.` }
  } catch {
    return { ok: false, status: 502, error: 'Could not reach Google. Check the connection and try again.' }
  }
}
