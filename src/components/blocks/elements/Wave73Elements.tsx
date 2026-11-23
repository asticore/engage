'use client'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { SignInForm } from '@/features/accounts/components/AuthForms'

import { str } from './elementUtil'
import './wave73.css'

/** Wave 73 client elements (Task 10, 29b): My account. Defs: wave73Defs.ts. */

type P = Record<string, unknown>
export type AccountTab = { href: string; label: string }

/** The tabs to show, in order. A prop is on unless it is exactly false. */
export function accountTabs(props: P): AccountTab[] {
  const all: Array<[string, string, string]> = [
    ['showOrders', '/account/orders', 'Orders'],
    ['showAddresses', '/account/addresses', 'Addresses'],
    ['showProfile', '/account/profile', 'Profile'],
    ['showBookings', '/account/bookings', 'Bookings'],
  ]
  return all.filter(([k]) => props[k] !== false).map(([, href, label]) => ({ href, label }))
}

export function MyAccountElement(props: P): React.ReactElement {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading')
  useEffect(() => {
    let live = true
    fetch('/api/visibility-state', { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { loggedIn?: unknown } | null) => { if (live) setState(j && j.loggedIn === true ? 'in' : 'out') })
      .catch(() => { if (live) setState('out') })
    return () => { live = false }
  }, [])
  const heading = str(props.heading) || 'My account'
  const tabs = accountTabs(props)
  return (
    <section className="w73-account" aria-label={heading}>
      <h2 className="w73-heading">{heading}</h2>
      {state === 'loading' && <p role="status" className="w73-note">Loading...</p>}
      {state === 'out' && <div className="w73-form"><SignInForm next="/account" /></div>}
      {state === 'in' && (
        <nav aria-label={heading}>
          <ul className="w73-tabs">
            {tabs.map((t) => <li key={t.href}><Link href={t.href}>{t.label}</Link></li>)}
            <li><Link href="/account">All account pages</Link></li>
          </ul>
        </nav>
      )}
    </section>
  )
}

export const WAVE73_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'my-account': MyAccountElement,
}
