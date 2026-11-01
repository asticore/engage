import React from 'react'

import { scoreBand } from '../types'
import './pagespeed.css'
import { Tooltip } from '@/components/admin/shared/Tooltip'
import { useAdminT } from '@/admin/i18n/AdminUiProvider'

/**
 * The "PageSpeed" list cell: the latest mobile performance score, green 90+, amber 50-89, red under 50,
 * and a dash when the page has never been tested. Server-renderable (no client state).
 */
export function PageSpeedBadge({ score, testedAt }: { score: unknown; testedAt?: unknown }) {
  const t = useAdminT()
  const value = typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : null
  if (value === null) {
    return (
      <Tooltip text={t('tip.neverTestedOpenThePage')}><span className="ps-badge ps-band--none">
        -
      </span></Tooltip>
    )
  }
  const band = scoreBand(value) ?? 'poor'
  const when = typeof testedAt === 'string' && testedAt ? ` ${t('tip.testedOn', { date: testedAt.slice(0, 10) })}` : ''
  return (
    <Tooltip text={t('tip.mobileScoreFromPsi', { when })}><span className={`ps-badge ps-band--${band}`}>
      {value}
    </span></Tooltip>
  )
}
