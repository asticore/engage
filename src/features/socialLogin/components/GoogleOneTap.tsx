'use client'

import { useEffect } from 'react'

/**
 * Google One Tap on the member sign-in page. Rendered only when the owner switched it on and Google
 * sign-in is complete (see public.ts). It fetches a client ID and a nonce from our own server, shows
 * Google's prompt, and posts the credential Google returns back to our server, which checks it and
 * signs the person in under the same rules as the Google button. Without Google's script (blocked,
 * offline) nothing happens and the normal form keeps working.
 */

type Google = {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void
      prompt: () => void
      cancel: () => void
    }
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client'

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { google?: Google }).google?.accounts?.id) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('blocked')), { once: true })
    if (!existing) {
      script.src = SCRIPT
      script.async = true
      document.head.appendChild(script)
    }
  })
}

export function GoogleOneTap({ next }: { next?: string }): null {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const query = next ? `?next=${encodeURIComponent(next)}` : ''
        const start = await fetch(`/api/social/one-tap${query}`, { credentials: 'same-origin' })
        if (!start.ok || cancelled) return
        const { clientId, nonce, state } = (await start.json()) as { clientId?: string; nonce?: string; state?: string }
        if (!clientId || !nonce || !state) return
        await loadScript()
        if (cancelled) return
        const google = (window as unknown as { google: Google }).google
        google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          callback: async (response: { credential?: string }) => {
            const result = await fetch('/api/social/one-tap', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential, state }),
            }).catch((): null => null)
            const body = (await result?.json().catch((): null => null)) as { ok?: boolean; redirect?: string; code?: string } | null
            if (body?.ok && body.redirect) window.location.assign(body.redirect)
            else window.location.assign(`/account/sign-in?social_error=${encodeURIComponent(body?.code || 'not-found')}`)
          },
        })
        google.accounts.id.prompt()
      } catch {
        // No prompt is better than a broken page.
      }
    })()
    return () => {
      cancelled = true
      try {
        ;(window as unknown as { google?: Google }).google?.accounts?.id?.cancel()
      } catch {
        // Nothing to cancel.
      }
    }
  }, [next])
  return null
}
