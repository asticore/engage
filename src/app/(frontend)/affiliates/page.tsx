import { notFound } from 'next/navigation'
import React from 'react'

import { DEFAULT_TERMS } from '@/features/affiliates/core'
import { getSettings, type D1 } from '@/features/affiliates/store'
import { JoinForm } from '@/features/affiliates/components/JoinForm'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Become an affiliate' }

export default async function AffiliatesPage() {
  if (!(await getFeatureFlags()).affiliates) notFound()
  const settings = await getSettings((await rawD1()) as never as D1)
  return (
    <div className="page-shell">
      <h1>Become an affiliate</h1>
      <p>
        Earn {settings.commissionPct}% commission on orders from people you send us. Your link is tracked for {settings.cookieDays} days.
      </p>
      <h2>Program terms</h2>
      <p style={{ whiteSpace: 'pre-line' }}>{settings.terms || DEFAULT_TERMS}</p>
      <h2>Join</h2>
      <JoinForm />
      <p>
        Already an affiliate with an account here? <a href="/account/affiliate">Sign in to see your dashboard</a>.
      </p>
    </div>
  )
}
