import { rawD1 } from '@/features/ecommerce/server/db'

import type { FrontendAssetsConfig } from './config'
import { FRONTEND_ASSETS_KEY, resetFrontendAssetsCache } from './store'

export async function saveFrontendAssets(config: FrontendAssetsConfig): Promise<void> {
  const d1 = await rawD1()
  const data = JSON.stringify(config)
  const updated = await d1.prepare('UPDATE `eg_kv` SET `data` = ? WHERE `key` = ?').bind(data, FRONTEND_ASSETS_KEY).run()
  if (!updated.meta?.changes) await d1.prepare('INSERT INTO `eg_kv` (`key`, `data`) VALUES (?, ?)').bind(FRONTEND_ASSETS_KEY, data).run()
  resetFrontendAssetsCache()
}
