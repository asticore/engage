import { secondOptionsResponse } from '@/features/accounts/passkeysHttp'

export const dynamic = 'force-dynamic'

/** POST /api/passkeys/second-options: passkey as the second sign-in step. */
export async function POST(request: Request): Promise<Response> {
  return secondOptionsResponse(request)
}
