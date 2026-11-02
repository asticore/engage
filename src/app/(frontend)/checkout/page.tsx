import React from 'react'

import { CheckoutForm } from '@/components/CheckoutForm'
import { CheckoutCurrencyNote } from '@/components/CheckoutCurrencyNote'
import { siteNameOf } from '@/features/brand/siteName'
import { getSiteSnapshot } from '@/features/speed/siteSnapshot'

// The name comes from the request's shared site snapshot (already read by the root layout), so no extra read.
export async function generateMetadata() {
  const siteName = siteNameOf((await getSiteSnapshot()).settings)
  return { title: `Checkout | ${siteName}` }
}

export default function CheckoutPage() {
  return (
    <div className="page-shell checkout-page">
      <h1>Checkout</h1>
      <CheckoutCurrencyNote />
      <CheckoutForm />
    </div>
  )
}
