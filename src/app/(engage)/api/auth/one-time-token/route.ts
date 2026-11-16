import { handleOneTimeCreate } from '@/features/apiKeys/tokens/http'
import { defaultTokenRuntime } from '@/features/apiKeys/tokens/runtime'

export const dynamic = 'force-dynamic'

/** POST /api/auth/one-time-token: make a one-time token for a link or handoff (staff API keys). */
export async function POST(request: Request): Promise<Response> {
  return handleOneTimeCreate(request, await defaultTokenRuntime())
}

export async function GET(request: Request): Promise<Response> {
  return handleOneTimeCreate(request, await defaultTokenRuntime())
}
