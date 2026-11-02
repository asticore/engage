import { getEngine } from '@/lib/engine'
import { renderEmbedPage, siteColourIds } from '@/features/forms/embedPage'

export const dynamic = 'force-dynamic'

/**
 * /embed/<key> - the hosted page of one embed of a form, for another website to put in an iframe. Each embed has
 * its own key, source name, websites and theme (Forms > External embeds). See features/forms/embedPage.tsx.
 */
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { key } = await params
  const query = await searchParams
  const engine = await getEngine()
  return renderEmbedPage(engine as never, key, query, await siteColourIds())
}
