import { NextResponse } from 'next/server'

import { saveImportedFile, type ImportContext } from '@/features/dam/importSave'
import { ImportError } from '@/features/dam/importUrl'
import * as damStore from '@/features/dam/store'
import { rawD1 } from '@/features/ecommerce/server/db'
import { adminRequestRefusal } from '@/features/forms/origin'
import { authorizeMedia } from '@/features/media/access'
import { userMayUse, type D1 as FolderD1 } from '@/features/media/folderRecordsStore'
import { sanitizeFolder } from '@/features/media/folders'
import { readJsonBody, readUploadPolicy, type MediaEngine } from '@/features/media/store'
import { fetchPosts } from '@/features/socialFeeds/adapters'
import { isPinimgUrl, pinApiUrl, pinIdFromAddress, pinImageFromApi } from '@/features/socialFeeds/pinterestImport'
import { readSocialAccounts } from '@/features/socialFeeds/service'
import { ValidationError } from '@/localapi/operations'
import { getFeatureFlags } from '@/utilities/features'

export const dynamic = 'force-dynamic'

const MAX_PER_RUN = 12

/**
 * POST /api/admin-media-pinterest  { account, pin?, folder? }
 * Imports pictures from Pinterest into Media. With `pin` (a pinterest.com pin address) it imports that one pin; without
 * it, the latest pins of the connected account's board. The account is one saved under Integrations, and its token is
 * never sent to the browser. Only pictures on Pinterest's image host are downloaded; each is saved like an upload.
 */
export async function POST(request: Request): Promise<Response> {
  const refusal = adminRequestRefusal(request)
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
  const auth = await authorizeMedia('create')
  if (!auth.context) return auth.response
  const body = await readJsonBody(request)
  if (!body || typeof body.account !== 'string') return NextResponse.json({ error: 'Choose a connected Pinterest account.' }, { status: 400 })
  const folder = sanitizeFolder(body.folder) ?? ''
  const engine = auth.context.engine as unknown as MediaEngine
  const userId = Number((auth.context.user as { id?: unknown } | null)?.id) || null
  try {
    const accounts = await readSocialAccounts(auth.context.engine as never)
    const account = accounts.find((a) => a.id === body.account && a.provider === 'pinterest')
    if (!account) return NextResponse.json({ error: 'Pinterest account not found. Connect it under Integrations first.' }, { status: 404 })

    const addresses: string[] = []
    if (typeof body.pin === 'string' && body.pin.trim()) {
      const id = pinIdFromAddress(body.pin)
      if (!id) return NextResponse.json({ error: 'That is not a Pinterest pin address (https://www.pinterest.com/pin/123456789/).' }, { status: 400 })
      const res = await fetch(pinApiUrl(id), { headers: { Authorization: `Bearer ${account.token}` }, redirect: 'error' }).catch((): null => null)
      if (!res || !res.ok) return NextResponse.json({ error: 'Pinterest did not return that pin. Check the address and that the account may see it.' }, { status: 502 })
      const image = pinImageFromApi(await res.text())
      if (!image) return NextResponse.json({ error: 'That pin has no picture to import.' }, { status: 422 })
      addresses.push(image)
    } else {
      const posts = await fetchPosts(account, MAX_PER_RUN)
      for (const post of posts) if (post.imageUrl && isPinimgUrl(post.imageUrl) && !post.video) addresses.push(post.imageUrl)
      if (addresses.length === 0) return NextResponse.json({ error: 'The board has no pictures to import.' }, { status: 422 })
    }

    const policy = await readUploadPolicy(engine)
    const d1 = (await rawD1()) as never as damStore.D1
    if (folder && !(await userMayUse(d1 as never as FolderD1, auth.context.user, auth.context.isAdmin, folder))) return NextResponse.json({ error: 'You do not have access to that folder.' }, { status: 403 })
    const ctx: ImportContext = { engine, user: auth.context.user, isAdmin: auth.context.isAdmin, userId, d1, dam: (await getFeatureFlags()).dam, maxBytes: policy.maxBytes }
    let imported = 0
    let skipped = 0
    for (const address of addresses) {
      try {
        const result = await saveImportedFile(ctx, new URL(address), false, folder, 'Pinterest')
        if (!('error' in result)) imported += 1
        else skipped += 1
      } catch (error) {
        if (error instanceof ImportError || error instanceof ValidationError) skipped += 1
        else throw error
      }
    }
    return NextResponse.json({ ok: true, imported, skipped })
  } catch (error) {
    console.error('Pinterest import failed:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'The Pinterest import did not work. Try again shortly.' }, { status: 502 })
  }
}
