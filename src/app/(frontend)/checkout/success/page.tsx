import { storeTexts } from '@/features/uiStrings/storeTextsServer'
import { translateWith } from '@/features/uiStrings/t'
import type { UiStringKey } from '@/features/uiStrings/keys'
import Link from 'next/link'
import React from 'react'

import { siteNameOf } from '@/features/brand/siteName'
import { getSiteSnapshot } from '@/features/speed/siteSnapshot'

// The name comes from the request's shared site snapshot (already read by the root layout), so no extra read.
export async function generateMetadata() {
  const siteName = siteNameOf((await getSiteSnapshot()).settings)
  return { title: `Order confirmed | ${siteName}` }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order } = await searchParams
  const dict = await storeTexts()
  const t = (key: UiStringKey) => translateWith(dict, key)

  return (
    <div className="page-shell checkout-success">
      <h1>{t('store.thankYou')}</h1>
      <p>{t('store.orderPlaced')}</p>
      {order && <p>{t('store.orderReference')} {order}</p>}
      <Link href="/shop" className="btn btn--primary">
        {t('store.continueShopping')}
      </Link>
    </div>
  )
}
