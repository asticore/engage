import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'

import { AffiliateDashboardView } from '@/features/affiliates/components/AffiliateDashboardView'
import { isToken } from '@/features/affiliates/core'
import { findByToken, type D1 } from '@/features/affiliates/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your affiliate dashboard', robots: { index: false, follow: false } }

export default async function AffiliateDashboard({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (!(await getFeatureFlags()).affiliates) notFound()
  const { token } = await searchParams
  if (!isToken(token)) notFound()
  const d1 = (await rawD1()) as never as D1
  const affiliate = await findByToken(d1, token)
  if (!affiliate) notFound()
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  return <AffiliateDashboardView d1={d1} affiliate={affiliate} origin={host ? `https://${host}` : ''} privateLink />
}
