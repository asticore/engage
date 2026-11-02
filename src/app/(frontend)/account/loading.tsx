import React from 'react'

import { accountTexts } from '@/features/accounts/portalCopy'

/** Shown while a signed-in screen is read on the server. Announced to screen readers, and the page keeps its frame. */
export default async function AccountLoading() {
  const tx = await accountTexts()
  return (
    <div className="page-shell" role="status" aria-live="polite" aria-busy="true">
      <p className="account-empty">{tx('common.loading')}</p>
    </div>
  )
}
