import { handleTokenExchange } from '@/features/apiKeys/tokens/http'
import { defaultTokenRuntime } from '@/features/apiKeys/tokens/runtime'

export const dynamic = 'force-dynamic'

/** POST /api/auth/token: trade an API key for a short-lived signed access token. */
export async function POST(request: Request): Promise<Response> {
  return handleTokenExchange(request, await defaultTokenRuntime())
}

export async function GET(request: Request): Promise<Response> {
  return handleTokenExchange(request, await defaultTokenRuntime())
}
