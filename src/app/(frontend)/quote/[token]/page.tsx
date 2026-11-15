import { notFound } from 'next/navigation'

import { isQuoteToken } from '@/features/quotes/logic'
import { QuoteView } from '@/features/quotes/QuoteView'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your quote', robots: { index: false, follow: false } }

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await getFeatureFlags()).quotes || !isQuoteToken(token)) notFound()
  return (
    <div className="page-shell">
      <h1>Your quote</h1>
      <QuoteView token={token} />
    </div>
  )
}
