import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'

import { canSeeBookingsByEmail } from '@/features/accounts/access'
import { requireCustomer } from '@/features/accounts/guards'
import { AffiliateDashboardView } from '@/features/affiliates/components/AffiliateDashboardView'
import { JoinForm } from '@/features/affiliates/components/JoinForm'
import { findByEmail, type D1 } from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your affiliate dashboard', robots: { index: false, follow: false } }

/**
 * /account/affiliate: the signed-in member's own affiliate dashboard. The affiliate record is found by the member's
 * email, and only when that email is verified, so typing someone else's address when joining cannot expose their results.
 */
export default async function AccountAffiliatePage() {
  const { flags, user } = await requireCustomer('/account/affiliate')
  if (!flags.affiliates) notFound()
  const email = String(user.email ?? '')
  if (!canSeeBookingsByEmail(user as never)) {
    return (
      <div className="page-shell">
        <h1>Your affiliate dashboard</h1>
        <p>Confirm your email address first (the link we sent when you registered), then come back here.</p>
      </div>
    )
  }
  const d1 = (await rawD1()) as never as D1
  const affiliate = await findByEmail(d1, email)
  if (!affiliate) {
    return (
      <div className="page-shell">
        <h1>Become an affiliate</h1>
        <p>You are not an affiliate yet. Join with the same email as your account ({email}) and this page will show your results.</p>
        <JoinForm />
      </div>
    )
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  return <AffiliateDashboardView d1={d1} affiliate={affiliate} origin={host ? `https://${host}` : ''} privateLink={false} />
}
