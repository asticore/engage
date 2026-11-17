import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { currentPortalLocale } from '@/features/multilingual/portalLocaleServer'
import { loadPortalTexts } from '@/features/multilingual/portalStrings'
import { requireCustomer } from '@/features/accounts/guards'
import { WholesaleApplyForm } from '@/features/ecommerce/components/WholesaleApplyForm'
import { rawD1 } from '@/features/ecommerce/server/db'
import { currentWholesaleConfig, getApplication, type D1 } from '@/features/ecommerce/server/wholesale'

export const dynamic = 'force-dynamic'
export async function generateMetadata(): Promise<Metadata> {
  const tx = await loadPortalTexts(await currentPortalLocale())
  return { title: tx('wholesale.title'), robots: { index: false, follow: false } }
}

/** /account/wholesale: the signed-in customer's own wholesale application and its status. Only while wholesale mode is on. */
export default async function AccountWholesalePage() {
  const { user } = await requireCustomer('/account/wholesale')
  const tx = await loadPortalTexts(await currentPortalLocale())
  const cfg = await currentWholesaleConfig()
  if (!cfg.enabled) notFound()
  const application = await getApplication((await rawD1()) as never as D1, Number(user.id))

  if (application?.status === 'approved') {
    return (
      <div className="page-shell">
        <h1>{tx('wholesale.title')}</h1>
        <p>{tx('wholesale.approved', { company: application.company })}</p>
      </div>
    )
  }
  if (application?.status === 'pending') {
    return (
      <div className="page-shell">
        <h1>{tx('wholesale.title')}</h1>
        <p>{tx('wholesale.pending', { company: application.company })}</p>
      </div>
    )
  }
  if (!cfg.applyOpen) {
    return (
      <div className="page-shell">
        <h1>{tx('wholesale.title')}</h1>
        <p>{tx('wholesale.closed')}</p>
      </div>
    )
  }
  return (
    <div className="page-shell">
      <h1>{tx('wholesale.title')}</h1>
      <p>{application?.status === 'rejected' ? tx('wholesale.rejected') : tx('wholesale.intro')}</p>
      <WholesaleApplyForm resend={application?.status === 'rejected'} text={{ company: tx('wholesale.company'), taxId: tx('wholesale.taxId'), phone: tx('wholesale.phone'), message: tx('wholesale.message'), apply: tx('wholesale.apply'), applyAgain: tx('wholesale.applyAgain'), done: tx('wholesale.done'), error: tx('wholesale.error') }} />
    </div>
  )
}
