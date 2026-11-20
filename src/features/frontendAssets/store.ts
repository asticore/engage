import { EMPTY_FRONTEND_ASSETS, normaliseAssets, type FrontendAssetsConfig } from './config'

/** Edge safe (the middleware reads it): nothing here may import the database layer. Writing lives in save.ts.
 * One row in `eg_kv` (no table of its own): the list is small and read on every public request, from isolate memory for 30 seconds. */
export const FRONTEND_ASSETS_KEY = 'frontend-assets'

let cached: { at: number; config: FrontendAssetsConfig } | null = null

export const resetFrontendAssetsCache = (): void => {
  cached = null
}

/** Never throws: a read problem means no extra files, and the site renders as before. */
export async function readFrontendAssets(): Promise<FrontendAssetsConfig> {
  const now = Date.now()
  if (cached && now - cached.at < 30_000) return cached.config
  let config = EMPTY_FRONTEND_ASSETS
  try {
    // The middleware and the layout both read this, so it goes through the Cloudflare binding like the CSP builder does.
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const context = await getCloudflareContext({ async: true })
    const d1 = context?.env?.D1 as unknown as D1Database | undefined
    if (!d1) throw new Error('no D1')
    const row = await d1.prepare('SELECT `data` FROM `eg_kv` WHERE `key` = ?').bind(FRONTEND_ASSETS_KEY).first<{ data: string }>()
    if (row?.data) config = normaliseAssets(JSON.parse(row.data))
  } catch {
    config = EMPTY_FRONTEND_ASSETS
  }
  cached = { at: now, config }
  return config
}
