import { notFound } from 'next/navigation'

import { isQuoteToken } from '@/features/quotes/logic'
import { QuoteView } from '@/features/quotes/QuoteView'
import { translateWith } from '@/features/uiStrings'
import { storeTexts } from '@/features/uiStrings/storeTextsServer'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your quote', robots: { index: false, follow: false } }

export default async function QuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await getFeatureFlags()).quotes || !isQuoteToken(token)) notFound()
  const dict = await storeTexts()
  return (
    <div className="page-shell">
      <h1>{translateWith(dict, 'store.quote.page.title')}</h1>
      <QuoteView token={token} />
    </div>
  )
}
