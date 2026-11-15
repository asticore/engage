import { notFound } from 'next/navigation'

import { BookingWidget } from '@/features/bookings/BookingWidget'
import * as store from '@/features/bookings/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!(await getFeatureFlags()).bookings) return { title: 'Book' }
  const type = await store.getTypeBySlug((await rawD1()) as never as store.D1, slug).catch((): null => null)
  return { title: type ? `Book: ${type.title}` : 'Book' }
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!(await getFeatureFlags()).bookings) notFound()
  const type = await store.getTypeBySlug((await rawD1()) as never as store.D1, slug).catch((): null => null)
  if (!type || !type.active) notFound()
  return (
    <div className="page-shell">
      <BookingWidget slug={slug} />
    </div>
  )
}
