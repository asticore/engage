import { NextRequest, NextResponse } from 'next/server'

import { getAdminContext } from '@/admin/auth'
import { assertSafe } from '@/features/dam/importUrl'
import { adminRequestRefusal } from '@/features/forms/origin'
import { extractThemeFromText } from '@/features/themeStyles/cloneSite'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }
const PAGE_LIMIT = 400_000
const SHEET_LIMIT = 300_000
const MAX_SHEETS = 3

/** Reads at most `limit` characters of a text response, following no redirects (a redirect could point at a local host). */
async function readText(url: URL, limit: number): Promise<string> {
  assertSafe(url)
  const res = await fetch(url, { redirect: 'manual', headers: { Accept: 'text/html,text/css' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`The site answered ${res.status}.`)
  const type = res.headers.get('content-type') ?? ''
  if (!/text\/(html|css)|application\/xhtml/i.test(type)) throw new Error('That address did not return a web page.')
  const text = await res.text()
  return text.slice(0, limit)
}

/**
 * POST /api/admin-theme-clone { url }: reads a public web page and its first stylesheets and returns a proposed palette,
 * fonts and corner radius. Nothing is saved: the editor shows the proposal and the owner confirms each value. Admins only.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const originRefusal = adminRequestRefusal(request)
    if (originRefusal) return NextResponse.json({ ok: false, error: originRefusal }, { status: 403, headers: NO_STORE })
    const context = await getAdminContext()
    if (!context.user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
    if (!context.isAdmin) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403, headers: NO_STORE })

    const body = (await request.json().catch((): null => null)) as { url?: unknown } | null
    let page: URL
    try {
      page = new URL(typeof body?.url === 'string' ? body.url.trim() : '')
    } catch {
      return NextResponse.json({ ok: false, error: 'Enter the full address, starting with https://.' }, { status: 400, headers: NO_STORE })
    }
    const html = await readText(page, PAGE_LIMIT)
    let text = html
    const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
      .map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1])
      .filter((href): href is string => Boolean(href))
      .slice(0, MAX_SHEETS)
    for (const href of sheets) {
      try {
        text += `\n${await readText(new URL(href, page), SHEET_LIMIT)}`
      } catch {
        // A stylesheet that cannot be read (another host, blocked, too slow) is skipped; the page's own styles still count.
      }
    }
    return NextResponse.json({ ok: true, host: page.hostname, theme: extractThemeFromText(text) }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'The site could not be read.'
    console.error('admin-theme-clone error:', error instanceof Error ? error.name : 'unknown')
    return NextResponse.json({ ok: false, error: message.length > 160 ? 'The site could not be read.' : message }, { status: 400, headers: NO_STORE })
  }
}
