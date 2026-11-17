import React from 'react'

import { DEFAULT_TERMS } from '@/features/affiliates/core'
import { getSettings, type D1 } from '@/features/affiliates/store'
import { JoinForm } from '@/features/affiliates/components/JoinForm'

import { flag } from './elementUtil'

/**
 * Affiliate sign-up element (def: src/lib/elements/affiliateDefs.ts). Public data only: the program rates and terms the
 * /affiliates page already shows. Renders nothing while Affiliates is off or when the settings cannot be read.
 */

type P = Record<string, unknown>

export async function AffiliateJoinElement(props: P): Promise<React.ReactElement | null> {
  try {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).affiliates) return null
    const { rawD1 } = await import('@/features/ecommerce/server/db')
    const settings = await getSettings((await rawD1()) as never as D1)
    return (
      <div className="affiliate-join" id="join">
        {flag(props.showSummary, true) && (
          <p>
            Earn {settings.commissionPct}% commission on orders from people you send us. Your link is tracked for {settings.cookieDays} days.
          </p>
        )}
        {flag(props.showTerms, true) && (
          <>
            <h3>Program terms</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{settings.terms || DEFAULT_TERMS}</p>
          </>
        )}
        <JoinForm />
        {flag(props.showSignIn, true) && (
          <p>
            Already an affiliate with an account here? <a href="/account/affiliate">Sign in to see your dashboard</a>.
          </p>
        )}
      </div>
    )
  } catch {
    return null
  }
}

export const AFFILIATE_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'affiliate-join': AffiliateJoinElement as never,
}
