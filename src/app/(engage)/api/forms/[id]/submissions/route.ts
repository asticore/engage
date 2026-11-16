import { buildCsv, csvFilename, type ExportRow } from '@/features/forms/csv'
import { authoriseKey, parseSubmissionQuery, shapeEntry, submissionsQuery } from '@/features/forms/dataApi'
import { FORMS_SLUG, SUBMISSIONS_SLUG } from '@/features/forms/slugs'
import type { FormDoc } from '@/features/forms/types'
import { getEngine } from '@/lib/engine'
import { requestSiteOrigin } from '@/utilities/siteOrigin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/forms/:id/submissions?page=1&limit=50&since=2026-11-01&until=2026-11-08&status=new&format=json|csv
 *
 * Entries of one form, oldest first so a puller can keep "since" at the last
 * entry it saw. Needs an API key with the form-submissions:read scope (dataApi.ts).
 * JSON: { form, page, limit, totalDocs, totalPages, hasNextPage, entries[] }.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const engine = await getEngine()
    const auth = await authoriseKey(engine as never, request, 'form-submissions')
    if (!auth.ok) return auth.response
    const { id } = await context.params
    if (!/^\d{1,12}$/.test(id)) return Response.json({ error: 'Form not found.' }, { status: 404 })
    const form = (await engine.findByID({ collection: FORMS_SLUG, id: Number(id), depth: 0, overrideAccess: true }).catch((): null => null)) as FormDoc | null
    if (!form) return Response.json({ error: 'Form not found.' }, { status: 404 })

    const query = parseSubmissionQuery(new URL(request.url).searchParams)
    if ('error' in query) return Response.json({ error: query.error }, { status: 400 })

    const result = await engine.find({
      collection: SUBMISSIONS_SLUG,
      where: submissionsQuery(Number(id), query) as never,
      sort: 'submittedAt',
      depth: 0,
      limit: query.limit,
      page: query.page,
      overrideAccess: true,
    })
    const docs = result.docs as unknown as Record<string, unknown>[]
    const origin = await requestSiteOrigin()
    const entries = await Promise.all(docs.map((doc) => shapeEntry(doc, origin)))

    if (query.format === 'csv') {
      const rows: ExportRow[] = entries.map((entry) => ({ id: entry.id, createdAt: entry.submittedAt, status: entry.status, total: entry.total, values: entry.values }))
      return new Response(`﻿${buildCsv(form, rows)}`, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${csvFilename(form)}"`, 'Cache-Control': 'no-store' },
      })
    }
    return Response.json(
      { form: { id: form.id, title: form.title || '' }, page: result.page, limit: query.limit, totalDocs: result.totalDocs, totalPages: result.totalPages, hasNextPage: result.hasNextPage, entries },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('forms submissions GET error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
