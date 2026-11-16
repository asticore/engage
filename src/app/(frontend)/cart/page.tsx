import type { Metadata } from 'next'
import React from 'react'

import { CartPageClient } from '@/components/CartPageClient'
import { cartPageReplaced } from '@/features/ecommerce/server/cartPage'
import BuiltPage, { generateMetadata as builtMetadata } from '../[...slug]/page'

export const dynamic = 'force-dynamic'

type Search = Promise<Record<string, string | string[] | undefined>>

/** The cart page. With "Build the cart page in the visual editor" on (Shop switches) and a published page at the slug cart, that page is shown instead. */
export async function generateMetadata(): Promise<Metadata> {
  return (await cartPageReplaced()) ? builtMetadata({ params: Promise.resolve({ slug: ['cart'] }) }) : { title: 'Your cart' }
}

export default async function CartPage({ searchParams }: { searchParams: Search }): Promise<React.ReactElement> {
  if (await cartPageReplaced()) return BuiltPage({ params: Promise.resolve({ slug: ['cart'] }), searchParams }) as unknown as React.ReactElement
  return <CartPageClient />
}
