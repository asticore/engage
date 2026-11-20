/**
 * Calling server functions from the browser without Next's server actions.
 *
 * Server actions make Next compile a third copy of everything an action file imports
 * (the "action" layer), which is about 1 MiB of the gzipped Worker. These files are plain
 * server modules instead, and the browser reaches them through one route, `/api/rpc`,
 * using the generated `*.client.ts` stubs next to each module (`scripts/gen-action-stubs.mjs`).
 *
 * Request: POST with the `x-engage-rpc: 1` header (a custom header, so a cross-site page
 * cannot send it without a CORS preflight). Body is JSON `{ m, f, a }`, or multipart when
 * an argument is a FormData: field `meta` holds that JSON with each FormData argument
 * replaced by `{ "$fd": index }`, and its entries are fields named `fd<index>:<name>`.
 */
export const RPC_PATH = '/api/rpc'
export const RPC_HEADER = 'x-engage-rpc'

export type RpcRequestMeta = { m: string; f: string; a: unknown[] }
export type RpcResponse = { ok: true; value: unknown } | { ok: false; error: string } | { redirect: string }

export function isFormDataLike(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData
}
