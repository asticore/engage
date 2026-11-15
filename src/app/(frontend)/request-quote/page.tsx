import { notFound } from 'next/navigation'

import { RequestForm } from '@/features/quotes/RequestForm'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Request a quote' }

type Search = { kind?: string; product?: string; title?: string }

/** /request-quote?kind=quote|bid|item&product=<id>&title=<name>: a ready page for the form, so a button on any page or product can link to it. */
export default async function RequestQuotePage({ searchParams }: { searchParams: Promise<Search> }) {
  if (!(await getFeatureFlags()).quotes) notFound()
  const q = await searchParams
  const kind = q.kind === 'bid' || q.kind === 'item' ? q.kind : 'quote'
  const product = Number(q.product)
  return (
    <div className="page-shell">
      <RequestForm kind={kind} productId={Number.isInteger(product) && product > 0 ? product : undefined} productTitle={q.title?.slice(0, 120)} />
    </div>
  )
}
