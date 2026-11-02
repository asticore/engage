import { getEngine } from '@/lib/engine'
import { renderEmbedPage, siteColourIds } from '@/features/forms/embedPage'

export const dynamic = 'force-dynamic'

/**
 * /embed/forms/<key> - the address embeds had before embeds had their own pages. It shows the same hosted page as
 * /embed/<key>, so the snippets already placed on other websites keep working.
 */
export default async function LegacyEmbedFormPage({
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
