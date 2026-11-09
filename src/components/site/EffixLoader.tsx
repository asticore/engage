'use client'

import { useEffect } from 'react'

/**
 * Starts Effix (asticore/effix, see reference/references.json) only on pages that use an `efx-` class. The loader then
 * fetches just the features the page needs. Fails safe: when the CDN is unreachable the page is simply not animated.
 * Disabled in the visual editor canvas by `data-efx-skip` on the editor root, so editing never runs effects.
 */
export const EFFIX_BASE = 'https://cdn.jsdelivr.net/gh/asticore/effix@576996d81a9f8ca0e78c3ed3a9f39dfe81fd00c6/dist/'

export function EffixLoader(): null {
  useEffect(() => {
    if (document.getElementById('effix-auto')) return
    if (!document.querySelector('[class*="efx-"]')) return
    const script = document.createElement('script')
    script.id = 'effix-auto'
    script.src = `${EFFIX_BASE}effix.auto.min.js`
    script.defer = true
    script.dataset.efxBase = EFFIX_BASE
    script.onerror = () => script.remove()
    document.body.appendChild(script)
  }, [])
  return null
}

export default EffixLoader
