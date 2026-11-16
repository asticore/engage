import { handleOneTapSignIn, handleOneTapStart } from '@/features/socialLogin/http'
import { runtimeWithVerification } from '@/features/socialLogin/runtime'

export const dynamic = 'force-dynamic'

/** GET: what Google One Tap needs (public client ID, nonce). POST: sign in with the credential Google returns. */
export async function GET(request: Request): Promise<Response> {
  return handleOneTapStart(request, await runtimeWithVerification())
}

export async function POST(request: Request): Promise<Response> {
  return handleOneTapSignIn(request, await runtimeWithVerification())
}
