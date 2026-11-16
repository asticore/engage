import { secondVerifyResponse } from '@/features/accounts/passkeysHttp'

export const dynamic = 'force-dynamic'

/** POST /api/passkeys/second-verify: passkey as the second sign-in step. */
export async function POST(request: Request): Promise<Response> {
  return secondVerifyResponse(request)
}
