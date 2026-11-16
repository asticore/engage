import React from 'react'

import { getFeatureFlags } from '@/utilities/features'

import { AffiliateCaptureClient } from './AffiliateCapture'

/** Mounted in the public layout. Renders the capture script only while Affiliates is switched on. */
export async function AffiliateCapture(): Promise<React.ReactElement | null> {
  const on = await getFeatureFlags().then((f) => Boolean(f.affiliates)).catch((): boolean => false)
  return on ? <AffiliateCaptureClient /> : null
}
