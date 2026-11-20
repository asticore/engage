'use client'

import React from 'react'

import { rpc } from './client'

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit'> & {
  /** Key from `features/rpc/modules.json`, e.g. `features/accounts/switcherActions`. */
  rpcModule: string
  /** Exported function of that module; it receives the form's FormData. */
  rpcFn: string
}

/** A `<form>` for server components: submits the fields to a server function through `/api/rpc` (what `<form action={serverAction}>` did). */
export function RpcForm({ rpcModule, rpcFn, children, ...rest }: Props): React.ReactElement {
  const [pending, setPending] = React.useState(false)
  return (
    <form
      {...rest}
      aria-busy={pending || undefined}
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        setPending(true)
        rpc(rpcModule, rpcFn)(new FormData(event.currentTarget))
          .catch((): undefined => undefined)
          .finally(() => setPending(false))
      }}
    >
      {children}
    </form>
  )
}
