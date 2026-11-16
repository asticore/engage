import React from 'react'
import type { Metadata } from 'next'

import { accountTitle } from '@/features/accounts/portalCopy'

import { accountMetadata } from '@/features/accounts'
import { AcceptTransferScreen } from '@/features/organizations/components/OrganizationScreens'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  // The title never carries the token or the organisation, and the page is kept out of search results by accountMetadata.
  return { ...(await accountMetadata(await accountTitle('auth.invitation'))), referrer: 'no-referrer' }
}

export default async function AcceptTransferRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <AcceptTransferScreen token={decodeURIComponent(token)} />
}
