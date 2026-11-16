'use client'

import { useEffect } from 'react'

/** Reads ?ref= once per browser tab and tells the server, which sets the cookie and logs the visit. Renders nothing. */
export function AffiliateCaptureClient(): null {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('ref')
      if (!code) return
      const key = `eg_ref_sent:${code}`
      if (window.sessionStorage.getItem(key)) return
      const send = (): void => {
        void fetch('/api/affiliate-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, path: window.location.pathname, utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign') }),
        })
          .then((res) => res.json() as Promise<{ needsConsent?: boolean }>)
          .then((data) => {
            // The site files this cookie under a consent category the visitor has not allowed yet: try again when they choose.
            if (data.needsConsent) window.addEventListener('engage:cookie-consent', send, { once: true })
            else window.sessionStorage.setItem(key, '1')
          })
          .catch((): void => undefined)
      }
      send()
    } catch {
      // Blocked storage just means no tracking for this visit.
    }
  }, [])
  return null
}
