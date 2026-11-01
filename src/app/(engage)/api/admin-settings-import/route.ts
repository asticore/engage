import { NextResponse } from 'next/server'
import { getAdminContext } from '@/admin/auth'
import { applyImport, parseImportSections, planImport, readExportFile } from '@/features/settingsTransfer/import'
import { ExportFormatError } from '@/features/settingsTransfer/format'
import { readLimitedText } from '@/lib/limitedBody'

/** Largest import body accepted. A full export with media details is far below this. */
const MAX_IMPORT_REQUEST_BYTES = 25 * 1024 * 1024

/**
 * Admin-only. Body: `{ file, password?, dryRun, sections?, allowAdminUsers? }`
 * where `file` is the parsed export (plain or encrypted). A dry run returns what
 * would change and writes nothing. Otherwise the import is applied. Imported
 * users with the admin role become editors unless `allowAdminUsers` is true.
 */
export async function POST(request: Request): Promise<Response> {
  const context = await getAdminContext()
  if (!context.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Counts the bytes as they arrive: Content-Length alone is only a claim.
  const read = await readLimitedText(request, MAX_IMPORT_REQUEST_BYTES, 'Import files must be 25 MB or smaller.')
  if ('response' in read) return read.response

  let body: unknown
  try {
    body = JSON.parse(read.text)
  } catch {
    return NextResponse.json({ error: 'Send the import request as JSON.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Send the import request as a JSON object.' }, { status: 400 })
  }

  const { file, password, dryRun, sections, allowAdminUsers } = body as Record<string, unknown>
  if (typeof dryRun !== 'boolean') {
    return NextResponse.json({ error: '"dryRun" must be true or false.' }, { status: 400 })
  }
  if (allowAdminUsers !== undefined && typeof allowAdminUsers !== 'boolean') {
    return NextResponse.json({ error: '"allowAdminUsers" must be true or false.' }, { status: 400 })
  }
  if (password !== undefined && password !== null && typeof password !== 'string') {
    return NextResponse.json({ error: '"password" must be text.' }, { status: 400 })
  }
  if (file === undefined || file === null) {
    return NextResponse.json({ error: 'No file was sent.' }, { status: 400 })
  }

  try {
    const parsed = await readExportFile(file, typeof password === 'string' ? password : undefined)
    const sectionList = parseImportSections(sections)
    const options = {
      sections: sectionList,
      origin: new URL(request.url).origin,
      allowAdminUsers: allowAdminUsers === true,
    }

    const report = dryRun
      ? await planImport(context.engine, parsed, options)
      : await applyImport(context.engine, parsed, options)
    return NextResponse.json({ success: true, report })
  } catch (error) {
    if (error instanceof ExportFormatError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Settings import failed:', error)
    return NextResponse.json({ error: 'The import could not be completed.' }, { status: 500 })
  }
}
