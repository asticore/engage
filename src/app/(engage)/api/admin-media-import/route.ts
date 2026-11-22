import { NextResponse } from 'next/server'

import { saveImportedFile } from '@/features/dam/importSave'
import { ImportError, parseImportAddress } from '@/features/dam/importUrl'
import * as damStore from '@/features/dam/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { userMayUse, type D1 as FolderD1 } from '@/features/media/folderRecordsStore'
import { sanitizeFolder } from '@/features/media/folders'
import { readJsonBody, readUploadPolicy, type MediaEngine } from '@/features/media/store'
import { ValidationError } from '@/localapi/operations'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin-media-import  { url, folder? }
 * Downloads one file from an https address or a Google Drive share link ("anyone with the link") and stores it like an
 * upload: type and size checks, folder rules and defaults, quotas, duplicate check, activity log.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
  const auth = await authorizeMedia('create')
  if (!auth.context) return auth.response
  const body = await readJsonBody(request)
  if (!body || typeof body.url !== 'string') return NextResponse.json({ error: 'Send the address to import.' }, { status: 400 })
  const folder = sanitizeFolder(body.folder) ?? ''
  const engine = auth.context.engine as unknown as MediaEngine
  const userId = Number((auth.context.user as { id?: unknown } | null)?.id) || null
  try {
    const policy = await readUploadPolicy(engine)
    const { url, drive } = parseImportAddress(body.url)
    const d1 = (await rawD1()) as never as damStore.D1
    if (folder && !(await userMayUse(d1 as never as FolderD1, auth.context.user, auth.context.isAdmin, folder))) return NextResponse.json({ error: 'You do not have access to that folder.' }, { status: 403 })
    const dam = (await getFeatureFlags()).dam
    const result = await saveImportedFile({ engine, user: auth.context.user, isAdmin: auth.context.isAdmin, userId, d1, dam, maxBytes: policy.maxBytes }, url, drive, folder, drive ? 'Google Drive link' : url.hostname)
    if ('error' in result) return NextResponse.json({ error: result.error, ...(result.duplicateOf ? { duplicateOf: result.duplicateOf } : {}) }, { status: result.status })
    return NextResponse.json({ ok: true, doc: result.doc, duplicateOf: result.duplicateOf })
  } catch (error) {
    if (error instanceof ImportError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.errors[0]?.message ?? 'This file cannot be used.' }, { status: /MB or smaller/.test(error.errors[0]?.message ?? '') ? 413 : 415 })
    console.error('Import failed:', error)
    return NextResponse.json({ error: 'The file could not be saved. Try again shortly.' }, { status: 502 })
  }
}
