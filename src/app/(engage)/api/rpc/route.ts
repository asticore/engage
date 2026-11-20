import { NextResponse } from 'next/server'

import { RPC_HEADER, type RpcRequestMeta, type RpcResponse } from '@/features/rpc/protocol'
import { RPC_MODULES } from '@/features/rpc/registry.generated'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

const reply = (body: RpcResponse, status = 200): Response => NextResponse.json(body, { status, headers: NO_STORE })

/** `redirect('/x')` inside a server function throws an error whose digest is `NEXT_REDIRECT;type;url;status;`. */
function redirectTarget(error: unknown): string | null {
  const digest = typeof error === 'object' && error !== null ? (error as { digest?: unknown }).digest : undefined
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT;')) return null
  const parts = digest.split(';')
  return parts.slice(2, -2).join(';') || null
}

function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    return false
  }
  return host === request.headers.get('host') || host === new URL(request.url).host
}

async function readRequest(request: Request): Promise<{ meta: RpcRequestMeta; args: unknown[] } | null> {
  const type = request.headers.get('content-type') ?? ''
  let raw: unknown
  let form: FormData | null = null
  if (type.includes('multipart/form-data')) {
    form = await request.formData()
    const text = form.get('meta')
    raw = typeof text === 'string' ? JSON.parse(text) : null
  } else raw = await request.json()
  const meta = raw as RpcRequestMeta | null
  if (!meta || typeof meta.m !== 'string' || typeof meta.f !== 'string' || !Array.isArray(meta.a)) return null
  const args = meta.a.map((arg, index) => {
    if (!form || typeof arg !== 'object' || arg === null || !('$fd' in arg)) return arg
    const slot = (arg as { $fd: number }).$fd
    const data = new FormData()
    const prefix = `fd${slot}:`
    for (const [key, value] of form.entries()) if (key.startsWith(prefix)) data.append(key.slice(prefix.length), value)
    void index
    return data
  })
  return { meta, args }
}

/** The browser's way into the server functions in `features/rpc/modules.json`. Only those modules' own exports can be called. */
export async function POST(request: Request): Promise<Response> {
  if (request.headers.get(RPC_HEADER) !== '1' || !sameSite(request)) return reply({ ok: false, error: 'Forbidden.' }, 403)
  let parsed: Awaited<ReturnType<typeof readRequest>>
  try {
    parsed = await readRequest(request)
  } catch {
    return reply({ ok: false, error: 'Bad request.' }, 400)
  }
  if (!parsed) return reply({ ok: false, error: 'Bad request.' }, 400)

  const { meta, args } = parsed
  const load = Object.prototype.hasOwnProperty.call(RPC_MODULES, meta.m) ? RPC_MODULES[meta.m] : undefined
  if (!load) return reply({ ok: false, error: 'Not found.' }, 404)
  const mod = await load()
  const fn = Object.prototype.hasOwnProperty.call(mod, meta.f) ? mod[meta.f] : undefined
  if (typeof fn !== 'function') return reply({ ok: false, error: 'Not found.' }, 404)

  try {
    const value = await (fn as (...a: unknown[]) => unknown)(...args)
    return reply({ ok: true, value: value === undefined ? null : value })
  } catch (error) {
    const to = redirectTarget(error)
    if (to) return reply({ redirect: to })
    console.error(`rpc ${meta.m}#${meta.f} failed`, error)
    return reply({ ok: false, error: 'Something went wrong. Try again.' }, 500)
  }
}
