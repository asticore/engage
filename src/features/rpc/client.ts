import { RPC_HEADER, RPC_PATH, isFormDataLike, type RpcResponse } from './protocol'

let refresh: (() => void) | null = null

/** Set by `RpcProvider`: re-renders the server components of the current page after an action ran. */
export function setRpcRefresh(fn: (() => void) | null): void {
  refresh = fn
}

/** The browser side of one server function: same name and arguments, runs through `/api/rpc`. */
export function rpc(moduleKey: string, name: string): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]) => {
    const plain: unknown[] = []
    const forms: { index: number; form: FormData }[] = []
    args.forEach((arg, index) => {
      if (isFormDataLike(arg)) {
        forms.push({ index, form: arg })
        plain.push({ $fd: index })
      } else plain.push(arg)
    })
    const meta = JSON.stringify({ m: moduleKey, f: name, a: plain })
    let body: BodyInit
    const headers: Record<string, string> = { [RPC_HEADER]: '1' }
    if (forms.length === 0) {
      body = meta
      headers['content-type'] = 'application/json'
    } else {
      const data = new FormData()
      data.set('meta', meta)
      for (const { index, form } of forms) for (const [key, value] of form.entries()) data.append(`fd${index}:${key}`, value)
      body = data
    }
    const res = await fetch(RPC_PATH, { method: 'POST', headers, body, credentials: 'same-origin' })
    let out: RpcResponse
    try {
      out = (await res.json()) as RpcResponse
    } catch {
      throw new Error(`Request failed (${res.status}).`)
    }
    if ('redirect' in out) {
      window.location.assign(out.redirect)
      return new Promise<never>(() => {})
    }
    if (out.ok !== true) throw new Error((out as { error: string }).error)
    refresh?.()
    return out.value
  }
}
