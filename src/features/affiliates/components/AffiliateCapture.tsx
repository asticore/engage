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
      window.sessionStorage.setItem(key, '1')
      void fetch('/api/affiliate-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, path: window.location.pathname, utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign') }),
      }).catch((): void => undefined)
    } catch {
      // Blocked storage just means no tracking for this visit.
    }
  }, [])
  return null
}
