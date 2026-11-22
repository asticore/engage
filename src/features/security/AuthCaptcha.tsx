'use client'

import React, { useEffect, useRef, useState } from 'react'

type Api = {
  turnstile?: { render: (el: HTMLElement, o: { sitekey: string; appearance?: string; callback: (t: string) => void }) => string }
  grecaptcha?: { ready: (cb: () => void) => void; execute: (key: string, o: { action: string }) => Promise<string> }
}

const load = (src: string, id: string): Promise<boolean> =>
  new Promise((resolve) => {
    if (document.getElementById(id)) return resolve(true)
    const el = document.createElement('script')
    el.id = id
    el.src = src
    el.async = true
    el.onload = () => resolve(true)
    el.onerror = () => resolve(false)
    document.head.appendChild(el)
  })

/**
 * Draws the challenge inside a sign-in, register or forgot-password form and fills the hidden field the server
 * checks (`cf-turnstile-response` or `g-recaptcha-response`). reCAPTCHA v3 gets a fresh token every 90 seconds.
 */
export const AuthCaptcha: React.FC<{ provider: 'turnstile' | 'recaptcha'; siteKey: string; appearance?: 'visible' | 'invisible'; fallback?: { question: string; token: string } | null }> = ({ provider, siteKey, appearance, fallback }) => {
  const box = useRef<HTMLDivElement>(null)
  const hidden = useRef<HTMLInputElement>(null)
  const [blocked, setBlocked] = useState(false)
  const [useText, setUseText] = useState(false)

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setInterval> | undefined
    if (provider === 'turnstile') {
      void load('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', 'engage-turnstile').then((ok) => {
        if (!ok && live) setBlocked(true)
        const api = (window as unknown as Api).turnstile
        if (!live || !api || !box.current || box.current.childElementCount > 0) return
        api.render(box.current, { sitekey: siteKey, ...(appearance === 'invisible' ? { appearance: 'interaction-only' } : {}), callback: (token: string) => { if (hidden.current) hidden.current.value = token } })
      })
    } else {
      void load(`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`, 'engage-recaptcha').then((ok) => {
        if (!ok && live) setBlocked(true)
        const api = (window as unknown as Api).grecaptcha
        if (!live || !api) return
        const refresh = () => api.ready(() => void api.execute(siteKey, { action: 'auth' }).then((t) => { if (hidden.current) hidden.current.value = t }).catch((): void => undefined))
        refresh()
        timer = setInterval(refresh, 90_000)
      })
    }
    return () => {
      live = false
      if (timer) clearInterval(timer)
    }
  }, [provider, siteKey, appearance])

  return (
    <>
      {provider === 'turnstile' && <div ref={box} />}
      {blocked && !fallback && (
        <p role="alert">The security check could not load. Please turn off any content blocker for this site, reload the page and try again, or contact the site owner.</p>
      )}
      {fallback && (useText || blocked) ? (
        <label className="captcha-fallback">
          {fallback.question}
          <input name="captcha-answer" type="text" inputMode="numeric" autoComplete="off" required aria-required="true" />
          <input type="hidden" name="captcha-token" value={fallback.token} />
        </label>
      ) : fallback ? (
        <button type="button" className="btn btn--style-secondary" onClick={() => setUseText(true)}>
          Can&apos;t use the security check? Answer a question instead
        </button>
      ) : null}
      <input ref={hidden} type="hidden" name={provider === 'turnstile' ? 'cf-turnstile-response' : 'g-recaptcha-response'} />
    </>
  )
}
