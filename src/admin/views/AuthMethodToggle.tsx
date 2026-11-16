'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { setMethodAreaAction, toggleAuthMethodAction } from '@/features/security/authMethodActions'

/** One accessible switch for a method on the Authentication overview. */
export function AuthMethodToggle({ id, label, on }: { id: string; label: string; on: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label} sign-in`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await toggleAuthMethodAction(id, !on)
            setMessage(result.message)
            if (result.ok) router.refresh()
          })
        }
      >
        {on ? 'On' : 'Off'}
      </button>
      <span role="status" aria-live="polite">{message}</span>
    </>
  )
}

/** Allow or block one method for one sign-in place. */
export function AreaToggle({ area, method, label, allowed }: { area: 'admin' | 'account' | 'members'; method: string; label: string; allowed: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={allowed}
        aria-label={`${label} on the ${area === 'admin' ? 'admin' : area === 'members' ? 'member' : 'customer'} sign-in`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setMethodAreaAction(area, method, !allowed)
            setMessage(result.message)
            if (result.ok) router.refresh()
          })
        }
      >
        {allowed ? 'Allowed' : 'Blocked'}
      </button>
      <span role="status" aria-live="polite">{message}</span>
    </>
  )
}
