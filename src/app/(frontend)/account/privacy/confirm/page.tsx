import React from 'react'
import type { Metadata } from 'next'

import { accountMetadata, requireFeature } from '@/features/accounts'
import { accountTitle } from '@/features/accounts/portalCopy'
import { PrivacyConfirm } from '@/features/privacy/components/PrivacyConfirm'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  // Not for search engines: the page holds a one-time deletion token in its address.
  return { ...(await accountMetadata(await accountTitle('privacy.confirmMetaTitle'))), robots: { index: false, follow: false } }
}

export default async function PrivacyConfirmRoute({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await requireFeature()
  const { token } = await searchParams
  return <PrivacyConfirm token={typeof token === 'string' ? token : ''} />
}
