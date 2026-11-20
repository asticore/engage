'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { setRpcRefresh } from './client'

/** Mount once in a layout: after any server function call the page's server components re-render, as they did after a server action. */
export function RpcProvider(): null {
  const router = useRouter()
  useEffect(() => {
    setRpcRefresh(() => router.refresh())
    return () => setRpcRefresh(null)
  }, [router])
  return null
}
