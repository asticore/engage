import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeatureFlags } from '@/utilities/features'

import * as store from '../store'

/**
 * The strip at the top of every public page of a demo site (Agency demos switched on and a banner text saved).
 * Renders nothing otherwise, so a live site never pays more than the feature check.
 */
export async function DemoBanner() {
  let text = ''
  try {
    if (!(await getFeatureFlags()).demos) return null
    text = (await store.getSettings((await rawD1()) as never as store.D1)).banner
  } catch {
    return null
  }
  if (!text) return null
  return (
    <div role="note" className="bg-accent px-4 py-2 text-center text-sm font-medium text-on-accent" data-demo-banner>
      {text}
    </div>
  )
}
