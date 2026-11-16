import { handleOneTimeVerify } from '@/features/apiKeys/tokens/http'
import { defaultTokenRuntime } from '@/features/apiKeys/tokens/runtime'

export const dynamic = 'force-dynamic'

/** POST /api/auth/one-time-token/verify: use a one-time token up (staff API keys). */
export async function POST(request: Request): Promise<Response> {
  return handleOneTimeVerify(request, await defaultTokenRuntime())
}

export async function GET(request: Request): Promise<Response> {
  return handleOneTimeVerify(request, await defaultTokenRuntime())
}
