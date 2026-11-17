import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { requireCustomer } from '@/features/accounts/guards'
import { WholesaleApplyForm } from '@/features/ecommerce/components/WholesaleApplyForm'
import { rawD1 } from '@/features/ecommerce/server/db'
import { currentWholesaleConfig, getApplication, type D1 } from '@/features/ecommerce/server/wholesale'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Wholesale account', robots: { index: false, follow: false } }

/** /account/wholesale: the signed-in customer's own wholesale application and its status. Only while wholesale mode is on. */
export default async function AccountWholesalePage() {
  const { user } = await requireCustomer('/account/wholesale')
  const cfg = await currentWholesaleConfig()
  if (!cfg.enabled) notFound()
  const application = await getApplication((await rawD1()) as never as D1, Number(user.id))

  if (application?.status === 'approved') {
    return (
      <div className="page-shell">
        <h1>Wholesale account</h1>
        <p>Your wholesale account for {application.company} is approved. Wholesale prices and products now show while you are signed in.</p>
      </div>
    )
  }
  if (application?.status === 'pending') {
    return (
      <div className="page-shell">
        <h1>Wholesale account</h1>
        <p>Your application for {application.company} is waiting for approval. We will approve or reject it as soon as we can.</p>
      </div>
    )
  }
  if (!cfg.applyOpen) {
    return (
      <div className="page-shell">
        <h1>Wholesale account</h1>
        <p>We are not taking wholesale applications right now.</p>
      </div>
    )
  }
  return (
    <div className="page-shell">
      <h1>Wholesale account</h1>
      {application?.status === 'rejected' ? <p>Your last application was not approved. You can apply again with updated details.</p> : <p>Apply for a wholesale account to see wholesale prices and products. We review each application, and approving it also sets up a company account for you.</p>}
      <WholesaleApplyForm resend={application?.status === 'rejected'} />
    </div>
  )
}
