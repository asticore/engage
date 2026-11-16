'use client'

import React, { useEffect, useRef } from 'react'

import { lastMethodCookie, methodFor, readLastMethod } from '../lastUsed'

/**
 * Wraps the sign-in screen. Remembers which method this browser used last and shows a small
 * "Last used" badge beside it next time. English only; if the cookie is blocked, nothing shows.
 */
export const LastUsedBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    let last: string | null = null
    try {
      last = readLastMethod(document.cookie)
    } catch {
      last = null
    }
    if (last) {
      const target = last === 'password' ? el.querySelector('form input[type="password"]')?.closest('form')?.querySelector('button[type="submit"]') : el.querySelector(`.account-social__button--${last}`)
      if (target && !target.parentElement?.querySelector('[data-last-used]')) {
        const badge = document.createElement('small')
        badge.setAttribute('data-last-used', '')
        badge.textContent = ' Last used'
        badge.style.opacity = '0.75'
        target.insertAdjacentElement('afterend', badge)
      }
    }
    const remember = (method: string | null) => {
      if (!method) return
      try {
        document.cookie = lastMethodCookie(method)
      } catch {
        // Blocked cookies just mean no badge.
      }
    }
    const onClick = (e: Event) => {
      const a = (e.target as HTMLElement | null)?.closest('a')
      if (a) remember(methodFor({ socialClass: a.className }))
    }
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement
      remember(methodFor({ formHasPassword: Boolean(form.querySelector('input[type="password"]')) }))
    }
    el.addEventListener('click', onClick)
    el.addEventListener('submit', onSubmit)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('submit', onSubmit)
    }
  }, [])

  return <div ref={root}>{children}</div>
}
