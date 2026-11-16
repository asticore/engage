import React from 'react'

import { STAGING_BLOCK_MESSAGE, isStaging } from '@/features/site/staging'

/** A strip at the top of every admin page on a staging site. Renders nothing on a live site. */
export function StagingBanner() {
  if (!isStaging()) return null
  return (
    <div role="status" style={{ padding: '0.5rem 16px', background: '#ffe8cc', color: '#5a2d00', borderBottom: '1px solid #e08a00', fontSize: '0.9rem' }}>
      <strong>Staging site.</strong> {STAGING_BLOCK_MESSAGE} Search engines are told to stay away.
    </div>
  )
}
