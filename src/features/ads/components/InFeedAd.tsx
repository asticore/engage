import React from 'react'

import { inFeedPositions } from '../inject'
import { getAdsContext } from '../server'
import { AdSlot } from './AdSlot'

/**
 * The in-feed ad slot for one item of a list: the first enabled "in-feed" placement
 * (set in Ads > Placements, with "every N items") puts its ad after every Nth item.
 * Renders nothing for the other items, and when there is no in-feed placement.
 */
export const InFeedAd = async ({ index, total }: { index: number; total: number }): Promise<React.ReactElement | null> => {
  const ctx = await getAdsContext()
  if (!ctx.config) return null
  const placement = ctx.placements.find((p) => p.enabled && p.mode === 'in-feed')
  if (!placement) return null
  if (!inFeedPositions(total, placement.feedEvery).includes(index)) return null
  return <AdSlot placement={placement.key} />
}
